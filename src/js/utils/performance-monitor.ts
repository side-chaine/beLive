export class PerformanceMonitor {
  static measureChatOpen(): void {
    performance.mark('chat-open-start');
  }

  static measureChatOpened(): void {
    performance.mark('chat-open-end');
    performance.measure('chat-open-duration', 'chat-open-start', 'chat-open-end');
    
    const measure = performance.getEntriesByName('chat-open-duration')[0];
    console.log(`✅ Chat opened in ${measure.duration.toFixed(2)}ms`);
    
    // ❌ FAIL если > 150ms
    if (measure.duration > 150) {
      console.warn('⚠️ Chat open time exceeded 150ms threshold');
    }
  }

  static measureFirstToken(): void {
    performance.mark('first-token');
    performance.measure('time-to-first-token', 'message-sent', 'first-token');
    
    const measure = performance.getEntriesByName('time-to-first-token')[0];
    console.log(`✅ First token in ${measure.duration.toFixed(2)}ms`);
  }
}
