# 465-MICRO-PACK · TASK-015 · V-MIX СТЕРЕО-РАЗВОДКА · по [@PROPOSAL] 006 (SYNC-OK 007)

**Источник истины:** `agent-registry/006-PROPOSAL-TASK-015-VMIX-STEREO.md` (читать вместе).
**SYNC-OK:** 007 прочитал полностью; принято E1-E4 + риски R1-R4.
**ДОПОЛНЕНИЕ 007 (закрывает пробел спеки):** точка связки центра — после создания router И доступности orchestrator: в main.tsx в блоке __belive (рядом `.monitorRouter`) добавить проводку `orchestrator.setVMixCenterTap(router.vmixCenterIn)` (оркестратор найти: grep `new StemOrchestrator|stemOrchestrator` в engine-v3; если инстанс не экспонирован — добавить `__belive.stemOrchestrator = <инстанс>` рядом с monitorRouter). Проводить ОДИН раз при буте: тап постоянный, тишину гейтит _vmixMaster=0.0; addStem-хук тогда ловит и поздние стемы.

**Порядок:** E1 → E2 → проводка → E3 → checkpoint.

## E1 · src/audio/engine-v3/core/StemOrchestrator.ts — центр-тап (S1)
Дословно из пропозала: поле `_vmixCenter: AudioNode | null = null`; метод setVMixCenterTap(node|null) с disconnect/connect циклом по не-vocals стемам; хук в addStem рядом с vocalHallInput-веткой.

## E2 · src/audio/engine-v3/monitor/MonitorRouter.ts — vmix-подграф + setVMix (S2/S3)
Поля vmixCenterIn/vmixVocalIn/vmixMicIn (публичные readonly GainNode), _vmixMerger=ChannelMerger(2), _vmixMaster=Gain(0.0=OFF); конструктор-виринг после мик-каскада; методы setVMix(on) crossfade 20ms defaultBranch↔_vmixMaster + isVMixOn(). Дословно из пропозала E2. 464b-тап не конфликтует.

## E2.5 · src/main.tsx — проводка центра (дополнение 007)
В блоке __belive (после `.monitorRouter = router`):
```ts
;(window as any).__belive.stemOrchestrator = <оркестратор>
;(window as any).__belive.stemOrchestrator?.setVMixCenterTap((window as any).__belive.monitorRouter.vmixCenterIn)
```
(оркестратор добыть: если pipeline держит его публично — из __belive.pipeline; иначе экспонировать из точки создания)

## E3 · src/components/ControlDeck.tsx — кнопка VMix (S4)
v3-ветка onClick: router.setVMix(!vocalMixEnabled) + useAudioStore.setState({vocalMixEnabled: next}); title «VMix — vocals L / music center / mic R (нужен включённый 🎤)». Фасад оставить только для engineMode==='v2'.

## VERIFICATION
tsc ровно 314 (grep -c "error TS") · vitest tests 763/763 · FROZEN-OK (StemOrchestrator/MonitorRouter/ControlDeck/main не frozen; VocalMix.ts только frozen-read).

## LIVE-PROOF (юзер после применения)
VMix ON → вокал оригинала ТОЛЬКО слева, минус в центре, 🎤 ON → ты справа; соло-вокал при VMix ON не задвоен; stemsEnabled OFF → центр молчит, вокал L поёт.
