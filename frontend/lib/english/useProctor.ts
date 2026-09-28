"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { getFaceDetector, withDetectorLogging } from "./faceDetector";

export type Screens = EventTarget & { screens: unknown[] };

export type ProctorResources = {
  camera: MediaStream;
  screen: MediaStream;
  displays: Screens;
};

export type ProctorEvent = {
  seq: number;
  type: string;
  section: string | null;
  ts_client: string;
  data: Record<string, unknown>;
};

export function useProctor(
  id: string | null,
  section: string | null,
  active: boolean,
  resources: ProctorResources | null,
  token?: string | null
) {
  const [reasons, setReasons] = useState<string[]>([]);
  const [networkOk, setNetworkOk] = useState(true);
  const sectionRef = useRef(section);
  const tokenRef = useRef(token);
  const flushRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    sectionRef.current = section;
  }, [section]);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    if (!active || !id || !resources) {
      return;
    }

    const live = resources;
    let stopped = false;
    let sending = false;
    let lastFace = Date.now();
    let badSince = 0;
    let faceReason = "";
    let focused = typeof document !== "undefined" ? document.hasFocus() : true;

    let seq = Number(
      typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem(`proctor:${id}`) || 0
        : 0
    );
    const pending: ProctorEvent[] = [];
    const known = new Set<string>();

    function log(type: string, data: Record<string, unknown> = {}) {
      seq += 1;
      pending.push({
        seq,
        type,
        section: sectionRef.current,
        ts_client: new Date().toISOString(),
        data,
      });
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(`proctor:${id}`, String(seq));
      }
    }

    async function flush() {
      if (sending || !pending.length || !id) return;
      sending = true;
      const batch = pending.slice(0, 100);
      try {
        await api.sendEnglishProctorEvents(id, batch, tokenRef.current || undefined);
        pending.splice(0, batch.length);
        if (!stopped) setNetworkOk(true);
      } catch {
        if (!stopped) setNetworkOk(false);
      } finally {
        sending = false;
      }
    }

    flushRef.current = async () => {
      while (sending) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      await flush();
    };

    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = live.camera;
    video.style.cssText = "position:fixed;width:1px;height:1px;left:-20px;opacity:0.01;pointer-events:none";
    document.body.appendChild(video);

    let detector: Awaited<ReturnType<typeof getFaceDetector>> | null = null;
    void video
      .play()
      .then(() => getFaceDetector())
      .then((d) => {
        detector = d;
      })
      .catch(() => {
        faceReason = "Camera monitoring unavailable";
      });

    function check() {
      const problems: Record<string, string> = {};
      if (document.hidden) problems.tab_hidden = "Return to the test tab";
      if (!focused) problems.window_blur = "Return to the test window";
      if (!document.fullscreenElement)
        problems.fullscreen_exit = "Restore fullscreen to continue";
      if (
        !live.camera
          .getTracks()
          .every((t) => t.readyState === "live" && !t.muted)
      ) {
        problems.camera_lost = "Reconnect your camera and microphone";
      }
      if (
        !live.screen
          .getVideoTracks()
          .every((t) => t.readyState === "live" && !t.muted)
      ) {
        problems.screen_share_stopped = "Share your entire screen again";
      }
      if (live.displays?.screens && live.displays.screens.length !== 1) {
        problems.second_monitor = "Disconnect the additional display";
      }
      if (faceReason) problems.face_check = faceReason;
      if (Date.now() - lastFace > 15000) {
        problems.monitoring_unavailable =
          "Camera monitoring unavailable — run the checks again";
      }

      for (const type of Object.keys(problems)) {
        if (!known.has(type)) {
          known.add(type);
          log(type, { message: problems[type] });
        }
      }
      for (const type of Array.from(known)) {
        if (!problems[type]) {
          known.delete(type);
          log("condition_restored", { condition: type });
        }
      }

      setReasons(Object.values(problems));
      void flush();
    }

    function blur() {
      focused = false;
      check();
    }
    function focus() {
      focused = true;
      check();
    }
    function clipboard(e: Event) {
      e.preventDefault();
      log("clipboard_blocked");
      void flush();
    }

    window.addEventListener("blur", blur);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", check);
    document.addEventListener("fullscreenchange", check);
    document.addEventListener("paste", clipboard);
    document.addEventListener("copy", clipboard);
    document.addEventListener("cut", clipboard);
    live.displays?.addEventListener("screenschange", check);

    const ticker = setInterval(check, 1000);
    const faces = setInterval(() => {
      if (!detector || video.readyState < 2 || document.hidden) return;
      try {
        const count = withDetectorLogging(() =>
          detector!.detectForVideo(video, performance.now())
        ).detections.length;
        lastFace = Date.now();
        if (count === 1) {
          badSince = 0;
          faceReason = "";
        } else {
          if (!badSince) badSince = Date.now();
          if (Date.now() - badSince > 4000) {
            faceReason =
              count === 0
                ? "Keep your face visible to the camera"
                : "Only the applicant should be visible";
          }
        }
      } catch {
        faceReason = "Camera monitoring unavailable";
      }
    }, 1000);

    log("heartbeat", { mode: "browser", camera: true, screen: true });
    void flush();

    const heart = setInterval(() => {
      log("heartbeat", { mode: "browser", conditions_ok: known.size === 0 });
      void flush();
    }, 10000);

    return () => {
      stopped = true;
      clearInterval(ticker);
      clearInterval(faces);
      clearInterval(heart);
      void flush();
      video.remove();
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", check);
      document.removeEventListener("fullscreenchange", check);
      document.removeEventListener("paste", clipboard);
      document.removeEventListener("copy", clipboard);
      document.removeEventListener("cut", clipboard);
      live.displays?.removeEventListener("screenschange", check);
    };
  }, [id, active, resources]);

  return { reasons, networkOk, flush: () => flushRef.current() };
}
