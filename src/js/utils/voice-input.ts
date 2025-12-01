type VoiceOpts = {
  onPartial?: (text: string) => void;
  onFinal?: (text: string) => void;
};

export class VoiceInput {
  private recognition: any = null;
  private isRecording = false;
  // private onResultCallback: ((text: string) => void) | null = null; // Удаляем это поле

  constructor(private opts: VoiceOpts) { // Принимаем opts в конструкторе
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn('Speech Recognition not supported');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = 'ru-RU';

    this.recognition.onresult = (event: any) => {
      let transcript = '';
      let isFinal = false;

      for (const result of event.results) {
        transcript += result[0].transcript;
        if (result.isFinal) {
          isFinal = true;
        }
      }

      this.opts.onPartial?.(transcript); // Вызываем onPartial для промежуточных результатов

      if (isFinal && this.opts.onFinal) {
        this.opts.onFinal(transcript);
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      this.stopRecording();
    };

    this.recognition.onend = () => {
      this.isRecording = false;
    };
  }

  startRecording(): boolean { // Больше не принимает колбэк здесь
    if (!this.recognition) return false;

    // this.onResultCallback = onResult; // Удаляем
    this.isRecording = true;
    this.recognition.start();
    return true;
  }

  stopRecording() {
    if (this.recognition && this.isRecording) {
      this.recognition.stop();
      this.isRecording = false;
    }
  }

  isActive(): boolean {
    return this.isRecording;
  }
}
