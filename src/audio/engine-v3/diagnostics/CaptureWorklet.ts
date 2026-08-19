// src/audio/engine-v3/diagnostics/CaptureWorklet.ts
// DR-077 Gate 3: AudioWorklet для захвата output сэмплов в ring buffer
// Opus fix: numberOfOutputs: 1 + passthrough + gain(0) → destination + 2s timeout
// Не изменяет DSP, не влияет на audio graph — только запись

/**
 * Функция, выполняемая в AudioWorkletGlobalScope.
 * Регистрирует процессор 'belive-capture-processor'.
 * Содержит кольцевой буфер + RPC для чтения.
 * ВАЖНО: Pure JS — никакого TypeScript-синтаксиса,
 * потому что функция сериализуется через toString() и исполняется в AudioWorklet.
 */
function captureWorkletCode(): void {
  var CAPTURE_NAME = 'belive-capture-processor'

  class CaptureProcessor extends AudioWorkletProcessor {
    constructor(options: any) {
      super(options)
      var size = (options && options.processorOptions && options.processorOptions.bufferSize) || 220500
      this._bufferSize = size
      this._buffer = new Float32Array(this._bufferSize)
      this._writeIndex = 0
      this._startFrame = -1
      this._firstNonZeroFrame = -1
      this._lastNonZeroFrame = -1
      this._energySumSq = 0
      this._firstNonZeroWriteIndexEver = -1
      this._processCount = 0
      this._maxAbsEver = 0
      this._firstNonZeroWriteIndex = -1
      this._nonZeroQuantumCount = 0
      this._totalSamplesWritten = 0
      this._wrapCount = 0
      this._quantumLenHist = {}

      // RPC обработчик — response [id, result]
      // ⚠️ Стрелочная функция! Обычная function() ломает this → MessagePort, не процессор.
      this.port.onmessage = (event: any) => {
        var data = event.data
        var id = data[0]
        var method = data[1]
        var args = data.slice(2)

        switch (method) {
          case 'read': {
            var length = (args[0] !== undefined) ? args[0] : this._bufferSize
            var safeLen = Math.min(length, this._bufferSize)
            var result = new Float32Array(safeLen)
            var wi = this._writeIndex
            var bs = this._bufferSize
            var buf = this._buffer
            for (var i = 0; i < safeLen; i++) {
              result[i] = buf[(wi - safeLen + i + bs) % bs]
            }
            this.port.postMessage([id, result])
            break
          }
          case 'clear': {
            this._buffer.fill(0)
            this._writeIndex = 0
            this._firstNonZeroWriteIndex = -1
            this._nonZeroQuantumCount = 0
            this._energySumSq = 0
            this.port.postMessage([id, true])
            break
          }
          case 'markStart': {
            this._startFrame = currentFrame
            this.port.postMessage([id, this._startFrame])
            break
          }
          case 'setBufferSize': {
            var newSize = Math.max(args[0] || 220500, 128)
            this._buffer = new Float32Array(newSize)
            this._bufferSize = newSize
            this._writeIndex = 0
            this.port.postMessage([id, true])
            break
          }
          case 'getStats': {
            this.port.postMessage([id, {
              processCount: this._processCount,
              writeIndex: this._writeIndex,
              bufferSize: this._bufferSize,
              wrapCount: this._wrapCount,
              maxAbsEver: this._maxAbsEver,
              firstNonZeroWriteIndex: this._firstNonZeroWriteIndex,
              nonZeroQuantumCount: this._nonZeroQuantumCount,
              totalSamplesWritten: this._totalSamplesWritten,
              quantumLenHist: this._quantumLenHist,
              startFrame: this._startFrame,
              firstNonZeroFrame: this._firstNonZeroFrame,
              lastNonZeroFrame: this._lastNonZeroFrame,
              energySumSq: this._energySumSq,
            }])
            break
          }
          case 'readWindow': {
            var start = args[0] !== undefined ? args[0] : 0
            var len = args[1] !== undefined ? args[1] : this._writeIndex
            var safeLen = Math.min(len, this._bufferSize - start)
            if (safeLen <= 0) {
              this.port.postMessage([id, new Float32Array(0)])
              break
            }
            var result = new Float32Array(safeLen)
            var buf = this._buffer
            for (var i = 0; i < safeLen; i++) {
              result[i] = buf[start + i]
            }
            this.port.postMessage([id, result])
            break
          }
          default:
            this.port.postMessage([id, null])
        }
      }
    }

    process(inputs: any, outputs: any, _parameters: any): boolean {
      var input = inputs[0]
      this._processCount++
      var output = outputs[0]

      // Passthrough: копируем input в output, чтобы Chrome не «засыпал» ноду
      if (output && output.length > 0 && output[0]) {
        if (input && input.length > 0 && input[0]) {
          for (var c = 0; c < output.length && c < input.length; c++) {
            output[c].set(input[c])
          }
        } else {
          for (var c = 0; c < output.length; c++) {
            output[c].fill(0)
          }
        }
      }

      // Запись в кольцевой буфер (только 1 канал)
      if (!input || input.length === 0 || input[0].length === 0) {
        return true
      }

      var channelData = input[0]
      var len = channelData.length
      var buf = this._buffer
      var bs = this._bufferSize
      var wi = this._writeIndex

      var hasNonZero = false
      var qStart = currentFrame   // frame первого сэмпла этого кванта
      for (var i = 0; i < len; i++) {
        var s = channelData[i]
        var a = (s < 0) ? -s : s
        if (a > this._maxAbsEver) this._maxAbsEver = a
        if (s < -1e-6 || s > 1e-6) {
          hasNonZero = true
          if (this._firstNonZeroWriteIndex < 0) {
            this._firstNonZeroWriteIndex = wi
            this._firstNonZeroWriteIndexEver = wi
            this._firstNonZeroFrame = qStart + i
          }
          this._lastNonZeroFrame = qStart + i
        }
        this._energySumSq += s * s
        buf[wi] = s
        wi = (wi + 1) % bs
      }
      if (hasNonZero) this._nonZeroQuantumCount++
      this._totalSamplesWritten += len
      this._wrapCount += Math.floor((this._writeIndex + len) / bs)
      this._quantumLenHist[String(len)] = (this._quantumLenHist[String(len)] || 0) + 1
      this._writeIndex = wi

      return true
    }
  }

  registerProcessor(CAPTURE_NAME, CaptureProcessor as unknown as typeof AudioWorkletProcessor)
}

let _captureLoadedKey = '_beliveCaptureWorkletLoaded'

/**
 * Создаёт и регистрирует capture-ворклет, возвращает AudioWorkletNode
 * Для изолированного AudioContext: гарантированно вызывает addModule() на нём.
 * Для in-situ (общий контекст): повторно использует уже загруженный модуль.
 */
export async function createCaptureNode(
  ctx: AudioContext,
  options?: {
    bufferSize?: number
  },
): Promise<AudioWorkletNode> {
  const bufferSize = options?.bufferSize ?? 220500

  if (!(ctx as any)[_captureLoadedKey]) {
    const code = `(${captureWorkletCode.toString()})();`
    const blob = new Blob([code], { type: 'text/javascript' })
    const blobUrl = URL.createObjectURL(blob)
    try {
      await ctx.audioWorklet.addModule(blobUrl)
    } finally {
      URL.revokeObjectURL(blobUrl)
    }
    ;(ctx as any)[_captureLoadedKey] = true
  }

  const node = new AudioWorkletNode(ctx, 'belive-capture-processor', {
    numberOfInputs: 1,
    numberOfOutputs: 1,     // Opus: output нужен чтобы process() тикал
    processorOptions: { bufferSize },
  })

  return node
}

/**
 * Универсальная RPC-утилита: postMessage + ожидание ответа [id, result] с таймаутом.
 */
function _rpc(node: AudioWorkletNode, method: string, args: any[], timeoutMs: number): Promise<any> {
  return new Promise(resolve => {
    const id = Math.random().toString(36).slice(2)
    const timer = setTimeout(() => {
      node.port.removeEventListener('message', handler)
      resolve(null)
    }, timeoutMs)
    const handler = (event: MessageEvent) => {
      const [msgId, data] = event.data
      if (msgId === id) {
        clearTimeout(timer)
        node.port.removeEventListener('message', handler)
        resolve(data)
      }
    }
    node.port.start()
    node.port.addEventListener('message', handler)
    node.port.postMessage([id, method, ...args])
  })
}

/**
 * Читает последние N захваченных сэмплов из capture-ворклета
 * Таймаут 2 секунды (Opus)
 */
export function readCapturedSamples(
  node: AudioWorkletNode,
  length: number,
): Promise<Float32Array | null> {
  return _rpc(node, 'read', [length], 2000) as Promise<Float32Array | null>
}

/**
 * Очищает буфер захвата
 */
export function clearCapturedSamples(node: AudioWorkletNode): Promise<void> {
  return _rpc(node, 'clear', [], 2000).then(() => undefined)
}

/**
 * Читает неубиваемую статистику capture-ворклета (maxAbsEver, wrapCount и т.д.)
 */
export function getCaptureStats(node: AudioWorkletNode): Promise<any> {
  return _rpc(node, 'getStats', [], 2000)
}
