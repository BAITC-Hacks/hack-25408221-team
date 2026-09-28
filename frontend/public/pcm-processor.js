/**
 * AudioWorkletProcessor: converts Float32 microphone samples -> Int16 PCM
 * The AudioContext is created at 16000 Hz so no downsampling is needed here.
 */
class PCMProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.chunks = [];
        this.bufferedLength = 0;
        this.targetLength = 512; // 512 samples @ 16kHz = 32ms
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (!input || !input[0] || input[0].length === 0) return true;

        this.chunks.push(input[0].slice());
        this.bufferedLength += input[0].length;

        if (this.bufferedLength >= this.targetLength) {
            const merged = new Float32Array(this.bufferedLength);
            let offset = 0;
            for (const chunk of this.chunks) {
                merged.set(chunk, offset);
                offset += chunk.length;
            }

            const int16 = new Int16Array(merged.length);
            for (let i = 0; i < merged.length; i++) {
                const s = Math.max(-1, Math.min(1, merged[i]));
                int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
            }

            this.port.postMessage(int16.buffer, [int16.buffer]);
            this.chunks = [];
            this.bufferedLength = 0;
        }

        return true;
    }
}

registerProcessor("pcm-processor", PCMProcessor);
