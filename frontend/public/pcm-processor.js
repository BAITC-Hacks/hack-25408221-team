/**
 * AudioWorkletProcessor: converts Float32 microphone samples → Int16 PCM
 * The AudioContext is created at 16000 Hz so no downsampling is needed here.
 */
class PCMProcessor extends AudioWorkletProcessor {
    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (!input || !input[0] || input[0].length === 0) return true;

        const float32 = input[0];
        const int16 = new Int16Array(float32.length);

        for (let i = 0; i < float32.length; i++) {
            const s = Math.max(-1, Math.min(1, float32[i]));
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        // Transfer the buffer (zero-copy)
        this.port.postMessage(int16.buffer, [int16.buffer]);
        return true;
    }
}

registerProcessor("pcm-processor", PCMProcessor);
