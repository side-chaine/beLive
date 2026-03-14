# Responsiveness Recovery

> **⚠️ This document is a domain-specific reference. For the complete current architecture, see [Architecture Map 2.1](./architecture-map-2.1.md).**

**Status:** Recovery architecture freeze candidate  
**Owner:** Center1.1  
**Last updated:** 2026-03-13  
**Related:**  
- `reactive-lyrics-foundation.md`
- `styles-system.md`
- `performance-quality-system.md`
- `research-council-verdict.md`

---

## 1. Purpose

This document captures the recovery architecture for reactive lyric responsiveness.

The system has already become richer:
- word FX
- line rails
- block-aware color routing
- performance tiers
- completed-word trail experiments

But current `Full` trail behavior revealed an important architectural problem:

- active word authority can become weaker
- completed words can become too visually rich
- the scene can become perceptually muddy
- responsiveness can feel worse even if timing truth is still correct

This document defines the strongest recovery direction.

---

## 2. Root Problem

The current issue is not only performance cost.

It is primarily a **visual authority problem**.

The active word must remain:
- the clearest
- the sharpest
- the most rhythmically immediate element in the scene

Completed / past words must not compete with it.

---

## 3. Active Word Authority Rule

A frozen recovery rule:

> There must be only one high-energy moving lyric leader at a time.

That leader is the **active fill word**.

Everything else must remain below it in visual authority.

---

## 4. Settled Trail Concept

The strongest recovery concept is to treat past words as:

## **settled**
not
## **completed-rich**

Settled words should feel like:
- sung history
- resolved memory
- quiet retained light

Settled words should not feel like:
- another active word
- a second rich visual carrier
- a moving or competitive effect

---

## 5. Authority Gradient

The lyric scene should obey this order:

1. active fill word
2. future cue words (later, not now)
3. preview line
4. settled history
5. others / background context

This gradient must not be violated.

---

## 6. Full / Trail Direction

The current `Full` idea is directionally correct,
but it should evolve toward a trail-depth model:

- Off
- Line
- Scene

Current binary `Full` is acceptable as a stepping stone,
but long-term architecture should think in trail scope rather than a simple on/off switch.

---

## 7. Strongest Recovery Rule

Completed history should become:
- static
- calmer
- simpler
- more uniform
- tier-aware

The system should stop giving each FX family an almost-active completed variant.

Instead:
- active word keeps family-specific richness
- settled words use a shared calmer palette

---

## 8. Tier-Aware Recovery

Performance tiers should affect:
- trail scope
- settled richness
- preview richness
- active FX richness

Performance tiers should never affect:
- timing truth
- active word detection truth
- cue/fill semantic truth

---

## 9. Recovery Order

### R0
Introduce settled trail architecture

### R1
Refine trail scope control

### R2
Expand tier-aware coverage to:
- settled trail
- preview
- progress richness

### R3
Only after recovery, continue into future cue words / Upcoming

---

## 10. One-Line Summary

**beLive should render sung history as settled memory behind the active word, not as a second active visual layer.**
