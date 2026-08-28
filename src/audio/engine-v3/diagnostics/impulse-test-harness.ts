// src/audio/engine-v3/diagnostics/impulse-test-harness.ts
// DR-077 Gate 3: Impulse/reference-delay test
// Подаёт 1-sample pulse через vendor stretch worklet, измеряет задержку выхода
// Сравнивает direct-offset и ring-buffer модели

import SignalsmithStretch from '../vendor/SignalsmithStretch.mjs'
import { createCaptureNode, readCapturedSamples, clearCapturedSamples } from './CaptureWorklet'

export interface ImpulseTestResult {
  pass: boolean
  measuredDelaySamples: number
  measuredDelayMs: number
  expectedLatencySamples: number
  expectedLatencyMs: number
  sampleShift: number             // measured - expected
  peakAmplitude: number
  peakIndex: number               // sample index of peak in captured output
  captureLengthMs: number
  impulseFeedTime: number          // ctx time when impulse was fed
  outputSum: number                // sum(abs(output)) — should be ~1.0 for clean impulse
}

export interface ImpulseTestOptions {
  rate?: number
  captureMs?: number            // сколько мс захватывать после импульса
}

/**
 * Runs impulse test on a dedicated AudioContext.
 * Creates a stretch node + capture node chain, feeds 1-sample impulse,
 * reads back captured output, measures delay.
 *
 * @returns test result with measured vs expected delay
 */
export async function runImpulseTest(options: ImpulseTestOptions = {}): Promise<ImpulseTestResult> {
  const rate = options.rate ?? 1.0
  const captureMs = options.captureMs ?? 500  // захватываем 500ms

  // Создаём изолированный AudioContext для теста
  const ctx = new AudioContext({ sampleRate: 44100 })

  try {
    ;(SignalsmithStretch as any).moduleUrl = import.meta.env.BASE_URL + 'vendor/SignalsmithStretch.mjs'
    // 1. Создаём stretch ноду
    const stretchNode = await SignalsmithStretch(ctx, {
      numberOfInputs: 0,
      outputChannelCount: [1],
    }) as unknown as AudioWorkletNode

    // Конфигурируем (те же параметры что в продакшене)
    await (stretchNode as any).configure({
      blockMs: 40,
      intervalMs: 20,
      splitComputation: true,
    })

    // Меряем latency
    const latency = await (stretchNode as any).latency()
    const expectedLatencySamples = Math.round(latency * ctx.sampleRate)
    const expectedLatencyMs = latency * 1000

    console.log('[ImpulseTest] stretch node ready, latency:', expectedLatencyMs.toFixed(1), 'ms')

    // 2. Создаём capture ноду
    const captureBufferSamples = Math.ceil(ctx.sampleRate * (captureMs / 1000))
    const captureNode = await createCaptureNode(ctx, {
      bufferSize: Math.max(captureBufferSamples + expectedLatencySamples * 2, 44100 * 4),
    })

    // 3. Соединяем: stretch → capture → silentGain(0) → destination
    //    Opus: capture имеет numberOfOutputs: 1 + passthrough
    //    silentGain(0) не пропускает звук в динамики, но держит граф активным
    const silentGain = ctx.createGain()
    silentGain.gain.value = 0
    ;(stretchNode as unknown as AudioNode).connect(captureNode as unknown as AudioNode)
    ;(captureNode as unknown as AudioNode).connect(silentGain)
    silentGain.connect(ctx.destination)

    // 4. Создаём импульсный буфер: [1.0, 0, 0, 0, ...] длиной 0.5 сек
    const impulseLength = Math.ceil(ctx.sampleRate * 0.5)
    const impulseSignal = new Float32Array(impulseLength)
    impulseSignal[0] = 1.0  // первый сэмпл = 1.0 (импульс)
    // остальные = 0

    console.log('[ImpulseTest] feeding impulse buffer:', impulseLength, 'samples')

    // 5. Загружаем импульс в stretch
    await (stretchNode as any).addBuffers([impulseSignal])

    // 6. Очищаем capture перед запуском
    await clearCapturedSamples(captureNode as unknown as AudioWorkletNode)

    // 7. Запускаем воспроизведение с offset=0, rate=1.0
    //    Opus: используем start() вместо schedule() — start ставит active: true
    await (stretchNode as any).start({ input: 0, rate, active: true })

    // 8. Ждём достаточно времени для прохода импульса через latency
    //    + небольшой запас (latency + 100ms)
    const waitTime = (expectedLatencyMs + 150) / 1000
    await new Promise(resolve => setTimeout(resolve, waitTime * 1000))

    // 9. Читаем захваченные сэмплы
    //    Берём последние (expectedLatencySamples + 500) сэмплов
    const readLength = expectedLatencySamples + 500
    const captured = await readCapturedSamples(captureNode as unknown as AudioWorkletNode, readLength)

    if (!captured || captured.length === 0) {
      console.error('[ImpulseTest] ❌ No captured samples')
      return {
        pass: false,
        measuredDelaySamples: -1,
        measuredDelayMs: -1,
        expectedLatencySamples,
        expectedLatencyMs,
        sampleShift: 0,
        peakAmplitude: 0,
        peakIndex: -1,
        captureLengthMs: 0,
        impulseFeedTime: ctx.currentTime,
        outputSum: 0,
      }
    }

    console.log('[ImpulseTest] captured', captured.length, 'samples')

    // 10. Анализируем: ищем пик (максимум abs)
    let peakIndex = -1
    let peakAmplitude = 0
    let outputSum = 0

    for (let i = 0; i < captured.length; i++) {
      const abs = Math.abs(captured[i])
      outputSum += abs
      if (abs > peakAmplitude) {
        peakAmplitude = abs
        peakIndex = i
      }
    }

    if (peakIndex < 0) {
      console.error('[ImpulseTest] ❌ No peak found in captured output')
      return {
        pass: false,
        measuredDelaySamples: -1,
        measuredDelayMs: -1,
        expectedLatencySamples,
        expectedLatencyMs,
        sampleShift: 0,
        peakAmplitude: 0,
        peakIndex: -1,
        captureLengthMs: readLength / ctx.sampleRate * 1000,
        impulseFeedTime: ctx.currentTime,
        outputSum,
      }
    }

    // Измеренная задержка: индекс пика
    const measuredDelaySamples = peakIndex
    const measuredDelayMs = (measuredDelaySamples / ctx.sampleRate) * 1000
    const sampleShift = measuredDelaySamples - expectedLatencySamples

    // PASS если peak > 0.5 (импульс не затух) и sampleShift в пределах ±5 сэмплов
    const pass = peakAmplitude > 0.5 && Math.abs(sampleShift) <= 5

    console.log('[ImpulseTest] 📊 Result:', {
      pass,
      measuredDelaySamples,
      measuredDelayMs: measuredDelayMs.toFixed(2),
      expectedLatencySamples,
      expectedLatencyMs: expectedLatencyMs.toFixed(2),
      sampleShift,
      peakAmplitude: peakAmplitude.toFixed(4),
    })

    return {
      pass,
      measuredDelaySamples,
      measuredDelayMs,
      expectedLatencySamples,
      expectedLatencyMs,
      sampleShift,
      peakAmplitude,
      peakIndex,
      captureLengthMs: readLength / ctx.sampleRate * 1000,
      impulseFeedTime: ctx.currentTime,
      outputSum,
    }

  } finally {
    // Всегда закрываем тестовый AudioContext
    await ctx.close()
    console.log('[ImpulseTest] ✅ AudioContext closed')
  }
}

/**
 * Сравнивает direct-offset и ring-buffer модели на impulse-тесте.
 * Вызывается после runImpulseTest с захваченными данными.
 */
export function compareModels(result: ImpulseTestResult): {
  directOffsetPass: boolean
  ringModelPass: boolean
  recommendation: 'direct-offset' | 'ring' | 'inconclusive'
} {
  // Direct-offset: output = input delayed by latencySamples
  // Если sampleShift ≈ 0 → direct-offset верен
  const directOffsetPass = Math.abs(result.sampleShift) <= 2

  // Ring model: output из кольцевого буфера
  // Пока не имплементирован — сравниваем только direct-offset
  // Ring будет добавлен после Gate 5
  const ringModelPass = false // TBD

  let recommendation: 'direct-offset' | 'ring' | 'inconclusive'
  if (directOffsetPass && result.pass) {
    recommendation = 'direct-offset'
  } else if (result.pass && Math.abs(result.sampleShift) <= 10) {
    recommendation = 'inconclusive'
  } else {
    recommendation = 'ring'
  }

  return { directOffsetPass, ringModelPass, recommendation }
}
