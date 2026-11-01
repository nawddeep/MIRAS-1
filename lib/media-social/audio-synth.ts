// Web Audio API ambient synthesizer for Udaipur heritage tracks
// Works offline and without external downloads

class HeritageAudioSynth {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  private initCtx() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
  }

  playTrack(trackId: string, isMuted = false) {
    this.stop();
    if (isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }

    this.isPlaying = true;

    // Pentatonic scale frequencies for Raag Bhupali & Desh
    const scales: Record<string, number[]> = {
      "track-1": [293.66, 329.63, 369.99, 440.0, 493.88, 587.33], // Kesariya Sarangi
      "track-2": [261.63, 293.66, 329.63, 392.0, 440.0, 523.25], // Twilight Flute
      "track-3": [220.0, 246.94, 277.18, 329.63, 369.99, 440.0], // Royal Sitar
      "track-4": [329.63, 392.0, 440.0, 493.88, 587.33, 659.25], // Santoor
      "track-5": [261.63, 293.66, 349.23, 392.0, 440.0, 523.25], // Ghoomar
    };

    const notes = scales[trackId] || scales["track-1"];
    let step = 0;

    const playNote = () => {
      if (!this.isPlaying || !this.ctx) return;

      const freq = notes[step % notes.length];
      step++;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = trackId === "track-2" ? "sine" : trackId === "track-4" ? "triangle" : "sawtooth";
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, this.ctx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.8);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.85);

      const delay = trackId === "track-5" ? 350 : 600;
      this.timer = setTimeout(playNote, delay);
    };

    playNote();
  }

  stop() {
    this.isPlaying = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

let synthInstance: HeritageAudioSynth | undefined;
export function getHeritageAudioSynth(): HeritageAudioSynth {
  return (synthInstance ??= new HeritageAudioSynth());
}

