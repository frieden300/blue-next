(() => {
    "use strict";

    // ─── AUDIO MANAGER ───────────────────────────────────────────────────────
    const SEGMENT_AUDIO = {
        "V4Lds": {
            src: "/assets/audio/V4LA.mp3",
            sync: true
        },
        "V5.14Lds": {
            src: "/assets/audio/V5and8LA.mp3",
            sync: false
        },
        "V6Lds_s27": {
            src: "/assets/audio/V6LA.mp3",
            sync: true
        },
        "V8Lds_b": {
            src: "/assets/audio/V5and8LA.mp3",
            sync: false
        },
    };

    const FADE_S = 0.55;
    const BG_VOL = 0.18;
    const SCENE_VOL = 0.82;
    const DUCK_VOL = 0.25;
    const SCENE_IDLE_MS = 350;

    const audioMgr = (() => {
        let ctx = null;
        let unlocked = false;
        let sceneTrack = null;
        let pendingKey = null;
        let duckTimer = null;
        let isDucked = false;
        const bufCache = Object.create(null);

        function getCtx() {
            if (!ctx || ctx.state === "closed") {
                ctx = new (window.AudioContext || window.webkitAudioContext)();
            }
            return ctx;
        }

        function fetchBuf(src) {
            if (bufCache[src]) return bufCache[src];
            bufCache[src] = fetch(src).then(r => r.arrayBuffer()).then(ab => getCtx().decodeAudioData(ab));
            return bufCache[src];
        }

        function ramp(gainNode, toVal, durationS) {
            if (!ctx || ctx.state === "closed") return;
            const ac = getCtx();
            gainNode.gain.cancelScheduledValues(ac.currentTime);
            gainNode.gain.setValueAtTime(gainNode.gain.value, ac.currentTime);
            gainNode.gain.linearRampToValueAtTime(toVal, ac.currentTime + durationS);
        }

        function makeLoop(buf, gainNode, startOffset) {
            const ac = getCtx();
            const src = ac.createBufferSource();
            src.buffer = buf;
            src.loop = true;
            src.connect(gainNode);
            src.start(0, startOffset % buf.duration);
            return src;
        }

        function makeLoopTracked(buf, gainNode, startOffset) {
            const ac = getCtx();
            const src = ac.createBufferSource();
            src.buffer = buf;
            src.loop = true;
            src.connect(gainNode);
            src.start(0, startOffset % buf.duration);
            return src;
        }

        function stopScene(cb) {
            if (!sceneTrack) {
                if (cb) cb();
                return;
            }
            const old = sceneTrack;
            sceneTrack = null;
            if (ctx && ctx.state !== "closed" && old.gain) {
                ramp(old.gain, 0, FADE_S);
            }
            setTimeout(() => {
                try {
                    if (old.src) old.src.stop();
                } catch (_) { }
                if (cb) cb();
            }, FADE_S * 1000 + 50);
        }

        function startScene(key, videoEl) {
            const def = SEGMENT_AUDIO[key];
            if (!def) return;
            fetchBuf(def.src).then(buf => {
                if (pendingKey !== key) return;
                const ac = getCtx();
                if (!ac || ac.state === "closed") return;
                const gain = ac.createGain();
                gain.gain.setValueAtTime(0, ac.currentTime);
                gain.connect(ac.destination);
                let offset = 0;
                if (def.sync && videoEl && Number.isFinite(videoEl.currentTime)) {
                    offset = videoEl.currentTime % buf.duration;
                }
                const src = makeLoop(buf, gain, offset);
                sceneTrack = {
                    buf,
                    src,
                    gain,
                    key,
                    def
                };
                ramp(gain, isDucked ? DUCK_VOL : SCENE_VOL, FADE_S);
            }).catch(() => { });
        }

        function onSegment(segmentFileKey, videoEl) {
            if (!unlocked) return;
            const key = segmentFileKey.replace(/\.mp4$/i, "").split("/").pop().replace(/^.*\//, "");
            pendingKey = key;
            if (sceneTrack && sceneTrack.key === key) return;
            stopScene(() => {
                if (pendingKey === key) startScene(key, videoEl);
            });
        }

        let lastSyncCheck = 0;

        function syncWatchdog(videoEl) {
            if (!sceneTrack || !sceneTrack.def.sync || !videoEl) return;
            if (!Number.isFinite(videoEl.currentTime) || !videoEl.duration) return;
            const now = performance.now();
            if (now - lastSyncCheck < 1500) return;
            lastSyncCheck = now;
            const ac = getCtx();
            if (!ac || ac.state === "closed") return;
            const buf = sceneTrack.buf;
            if (sceneTrack._startedAtAcTime !== undefined) {
                const elapsed = ac.currentTime - sceneTrack._startedAtAcTime;
                const audioPhase = (sceneTrack._startOffset + elapsed) % buf.duration;
                const videoPhase = videoEl.currentTime % buf.duration;
                const drift = Math.abs(audioPhase - videoPhase);
                if (drift > 0.12) {
                    try {
                        sceneTrack.src.stop();
                    } catch (_) { }
                    const gain = sceneTrack.gain;
                    const offset = videoEl.currentTime % buf.duration;
                    const src = makeLoop(buf, gain, offset);
                    sceneTrack.src = src;
                    sceneTrack._startedAtAcTime = ac.currentTime;
                    sceneTrack._startOffset = offset;
                }
            }
        }

        function onLoopRestart() {
            if (!sceneTrack || !sceneTrack.def.sync) return;
            const buf = sceneTrack.buf;
            const gain = sceneTrack.gain;
            try {
                sceneTrack.src.stop();
            } catch (_) { }
            const ac = getCtx();
            if (!ac || ac.state === "closed") return;
            const src = makeLoopTracked(buf, gain, 0);
            sceneTrack.src = src;
            sceneTrack._startedAtAcTime = ac.currentTime;
            sceneTrack._startOffset = 0;
        }

        function duck() {
            if (!sceneTrack) return;
            if (isDucked) return;
            isDucked = true;
            ramp(sceneTrack.gain, DUCK_VOL, 0.15);
            if (duckTimer) clearTimeout(duckTimer);
        }

        function unduck() {
            if (!isDucked) return;
            isDucked = false;
            if (sceneTrack) ramp(sceneTrack.gain, SCENE_VOL, 0.4);
        }

        function scheduledUnduck() {
            if (duckTimer) clearTimeout(duckTimer);
            duckTimer = setTimeout(unduck, SCENE_IDLE_MS);
        }

        function unlock() {
            if (unlocked) return;
            unlocked = true;
            getCtx().resume().then(() => {
                if (typeof segments !== "undefined" && typeof activeSegment !== "undefined") {
                    const seg = segments[activeSegment];
                    if (seg && typeof videos !== "undefined" && videos[activeVideo]) {
                        onSegment(seg.file, videos[activeVideo]);
                    }
                }
            }).catch(() => { });
        }

        function destroy() {
            if (duckTimer) {
                clearTimeout(duckTimer);
                duckTimer = null;
            }
            isDucked = false;
            pendingKey = null;
            if (sceneTrack) {
                try {
                    if (sceneTrack.src) sceneTrack.src.stop();
                    if (sceneTrack.gain) sceneTrack.gain.disconnect();
                } catch (_) { }
                sceneTrack = null;
            }
            if (ctx && ctx.state !== "closed") {
                try {
                    ctx.close();
                } catch (_) { }
                ctx = null;
            }
            unlocked = false;
        }

        return {
            unlock,
            onSegment,
            onLoopRestart,
            syncWatchdog,
            duck,
            scheduledUnduck,
            destroy
        };
    })();

    // ─── CENTRALIZED EVENT MANAGER ───────────────────────────────────────────
    const eventManager = {
        listeners: [],
        add(target, type, handler, options) {
            if (!target || typeof target.addEventListener !== "function") return;
            target.addEventListener(type, handler, options);
            this.listeners.push({ target, type, handler, options });
        },
        removeAll() {
            for (let i = 0; i < this.listeners.length; i++) {
                const item = this.listeners[i];
                try {
                    item.target.removeEventListener(item.type, item.handler, item.options);
                } catch (_) { }
            }
            this.listeners = [];
        }
    };

    // ─── SEGMENTS CONFIGURATION ──────────────────────────────────────────────
    const segments = [{
        stage: 0,
        mode: "LOOP",
        type: "loop",
        file: "V1Lrus_s36.mp4",
        weight: 1,
        eyebrow: "01 / THE BEGINNING",
        title: "One planet.<br><em>One blue world.</em>",
        description: "A journey from the edge of our atmosphere into the quiet depths of the ocean.",
        name: "BLUE PLANET"
    }, {
        stage: 1,
        mode: "PASSAGE",
        type: "passage",
        file: "V2Pds_s36cV3Pds.mp4",
        weight: 1.15,
        eyebrow: "02 / LAND IN SIGHT",
        title: "Where the land<br><em>meets the sea.</em>",
        description: "From the vast blue planet to a distant island, the ocean brings us closer.",
        name: "ISLAND TO BEACH"
    }, {
        stage: 2,
        mode: "LOOP",
        type: "loop",
        file: "V4Lds.mp4",
        weight: .8,
        eyebrow: "03 / THE HORIZON",
        title: "Stay for a<br><em>little longer.</em>",
        description: "Let the tide set the pace. Here, the horizon is only the beginning.",
        name: "BLUE HORIZON"
    }, {
        stage: 3,
        mode: "PASSAGE",
        type: "passage",
        file: "V5.00Pds.mp4",
        weight: .45,
        eyebrow: "04 / THE DESCENT",
        title: "Cross the surface.<br><em>Enter another world.</em>",
        description: "The light changes. The noise fades. A different world begins below.",
        name: "ENTERING THE OCEAN"
    }, {
        stage: 3,
        mode: "LOOP",
        type: "loop",
        file: "V5.14Lds.mp4",
        weight: .65,
        eyebrow: "04 / THE DESCENT",
        title: "Let the blue<br><em>surround you.</em>",
        description: "Take a moment beneath the surface, where sunlight becomes a language of its own.",
        name: "ENTERING THE OCEAN"
    }, {
        stage: 3,
        mode: "PASSAGE",
        type: "passage",
        file: "V5.47Pds_s27.mp4",
        weight: .45,
        eyebrow: "04 / THE DESCENT",
        title: "Follow the current<br><em>into the deep.</em>",
        description: "The journey continues, toward the life hidden below.",
        name: "ENTERING THE OCEAN"
    }, {
        stage: 4,
        mode: "LOOP",
        type: "loop",
        file: "V6Lds_s27.mp4",
        weight: .8,
        eyebrow: "05 / THE EXPEDITION",
        title: "A quiet pause<br><em>on the water.</em>",
        description: "A boat, an open sea, and the promise of everything waiting underneath.",
        name: "DIVE BOAT"
    }, {
        stage: 5,
        mode: "PASSAGE",
        type: "passage",
        file: "V7Pds.mp4",
        weight: 1,
        eyebrow: "06 / BELOW THE LIGHT",
        title: "A living world<br><em>reveals itself.</em>",
        description: "Descend toward the reef, where colour and movement gather in the blue.",
        name: "CORAL DESCENT"
    }, {
        stage: 6,
        mode: "LOOP",
        type: "loop",
        file: "V8Lds_b.mp4",
        weight: 1.2,
        eyebrow: "07 / THE ABYSS",
        title: "Welcome to <br><em>The Blue Abyss.</em>",
        description: "A final moment in the underwater world. The ocean is vast, and there is still more to discover.",
        name: "BLUE ABYSS"
    }];

    // Dynamic DOM references (re-queried on each boot)
    let videos = [];
    let copy = null;
    let eyebrow = null;
    let heading = null;
    let description = null;
    let stageName = null;
    let modeLabel = null;
    let number = null;
    let loading = null;
    let prompt = null;
    let particles = null;
    let dots = [];
    let journeyCta = null;
    let experience = null;

    function queryDOMElements() {
        videos = [document.querySelector("#videoA"), document.querySelector("#videoB")];
        copy = document.querySelector(".copy");
        eyebrow = document.querySelector("#eyebrow");
        heading = document.querySelector("#heading");
        description = document.querySelector("#description");
        stageName = document.querySelector("#stageName");
        modeLabel = document.querySelector("#modeLabel");
        number = document.querySelector("#progressNumber");
        loading = document.querySelector("#loading");
        prompt = document.querySelector("#scrollPrompt");
        particles = document.querySelector("#particles");
        dots = [...document.querySelectorAll(".journey-nav button")];
        journeyCta = document.querySelector("#journeyCta");
        experience = document.querySelector(".experience");
    }

    const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    let activeVideo = 0;
    let activeSegment = 0;
    let target = 0;
    let smooth = 0;
    let currentPassageFrame = 0;
    let lastFrameStepTime = 0;
    let lastInputAt = -Infinity;
    const PROMPT_IDLE_FADE_MS = 600;
    let lastLoopForwardAt = -Infinity;
    let allowLoopTransition = false;
    let pendingLoopNext = null;
    let loadToken = 0;
    let touchY = null;
    let wheelAccumulator = 0;
    let holdMode = false;
    const HOLD_PLAYBACK_RATE = 2.5;

    // ─── LOOP PLAYBACK & SCROLL FAST-FORWARD TUNING ───────────────────────────
    const V1L_BASE_PLAYBACK_RATE = 1.2;
    const OTHER_LOOPS_BASE_PLAYBACK_RATE = 1.0;
    const V1L_SCROLL_SPEED_MULTIPLIER = 4.0;
    const DEFAULT_LOOP_SCROLL_SPEED_MULTIPLIER = 2.0;

    let loopScrollBoost = 0;
    const SCROLL_IDLE_MS = 260;

    const V1L_LOOP_EXIT_WINDOW_S = 0.3;
    const OTHER_LOOPS_EXIT_WINDOW_S = 0.3;

    let copyAnimTimer = null;
    let videoFadeTimeout = null;
    let touchHoldTimeout = null;
    let lastPromptOpacity = "";
    let renderRafId = null;
    let destroyed = true;
    let isActive = false;

    const INPUT_DISTANCE_PER_VIEWPORT = 1.0;
    const WHEEL_SENSITIVITY = 0.015;
    const TOUCH_SENSITIVITY = 0.2;
    const TOUCH_HOLD_DELAY_MS = 380;
    const TOUCH_MOVE_CANCEL_DIST = 10;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchIsScrolling = false;

    const totalWeight = segments.reduce((sum, segment) => sum + segment.weight, 0);
    const starts = [];
    let weightSum = 0;
    segments.forEach(segment => {
        starts.push(weightSum / totalWeight);
        weightSum += segment.weight;
    });

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    function applyPassageSeek(video, targetTime) {
        if (!video || video.seeking) return;
        if (Math.abs(video.currentTime - targetTime) < 0.015) return;
        try {
            video.currentTime = targetTime;
        } catch (_) { }
    }

    function segmentAt(progress) {
        const position = clamp(progress, 0, 0.999999) * totalWeight;
        let accumulated = 0;
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            if (position < accumulated + segment.weight) {
                return {
                    index: i,
                    local: clamp((position - accumulated) / segment.weight, 0, 1)
                };
            }
            accumulated += segment.weight;
        }
        return {
            index: segments.length - 1,
            local: 1
        };
    }

    function updateCopy(index) {
        const segment = segments[index];
        const cta = document.querySelector("#journeyCta");
        if (cta) {
            cta.classList.toggle("is-visible", segment.stage === 0 || segment.stage === 6);
            const ctaTitle = cta.querySelector(".journey-cta-title");
            if (ctaTitle) ctaTitle.textContent = segment.stage === 6 ? "Explore beyond the abyss" : "Explore the BLUE";
            cta.setAttribute("aria-hidden", String(!(segment.stage === 0 || segment.stage === 6)));
            cta.tabIndex = (segment.stage === 0 || segment.stage === 6) ? 0 : -1;
        }

        if (copyAnimTimer) {
            clearTimeout(copyAnimTimer);
            copyAnimTimer = null;
        }

        if (eyebrow && heading && description && copy) {
            if (reduced) {
                eyebrow.textContent = segment.eyebrow;
                heading.innerHTML = segment.title;
                description.textContent = segment.description;
            } else {
                copy.classList.remove("entering");
                copy.classList.add("changing");
                copyAnimTimer = setTimeout(() => {
                    copyAnimTimer = null;
                    if (destroyed || !isActive) return;
                    eyebrow.textContent = segment.eyebrow;
                    heading.innerHTML = segment.title;
                    description.textContent = segment.description;

                    copy.classList.remove("changing");
                    copy.classList.add("entering");
                    void copy.offsetWidth;
                    copy.classList.remove("entering");
                }, 300);
            }
        }

        if (stageName) stageName.textContent = segment.name;
        if (modeLabel) modeLabel.textContent = segment.mode;
        if (number) number.textContent = String(segment.stage + 1).padStart(2, "0");
        if (dots && dots.length) {
            dots.forEach((dot, i) => dot.classList.toggle("active", i === segment.stage));
        }
        if (particles) particles.classList.toggle("on", segment.stage >= 3);
    }

    function restartLoop(video, segment) {
        video.loop = true;
        const baseRate = segment.stage === 0 ? V1L_BASE_PLAYBACK_RATE : OTHER_LOOPS_BASE_PLAYBACK_RATE;
        video.playbackRate = baseRate;
        video.defaultPlaybackRate = baseRate;
        try {
            video.currentTime = 0;
        } catch (_) { }
        video.play().catch(() => { });
        audioMgr.onLoopRestart(video);
    }

    function handleLoopEnded(video, segment) {
        if (destroyed || !isActive) return;
        const wantsNext = (pendingLoopNext === activeSegment + 1) || (segmentAt(target).index > activeSegment);
        if (wantsNext && activeSegment + 1 < segments.length) {
            allowLoopTransition = true;
            target = starts[activeSegment + 1] + 0.00001;
            smooth = target;
            pendingLoopNext = null;
            return;
        }
        pendingLoopNext = null;
        allowLoopTransition = false;
        target = starts[activeSegment] + 0.00001;
        smooth = target;
        restartLoop(video, segment);
    }

    function activateSegment(index) {
        if (destroyed || !isActive) return;
        if (index === activeSegment) return;
        const enteringBackward = index < activeSegment;
        const segment = segments[index];
        const token = ++loadToken;
        const nextIndex = 1 - activeVideo;
        const nextVideo = videos[nextIndex];
        const oldVideo = videos[activeVideo];
        const source = `/assets/master/${segment.file}`;
        activeSegment = index;
        allowLoopTransition = false;
        pendingLoopNext = null;

        if (segment.type === "loop" && !enteringBackward) {
            target = starts[index] + 0.00001;
            smooth = target;
            loopScrollBoost = 0;
        }
        updateCopy(index);

        const showVideo = () => {
            if (token !== loadToken || destroyed || !isActive) return;
            nextVideo.onended = null;
            nextVideo.loop = false;
            if (holdMode) {
                nextVideo.loop = false;
                nextVideo.playbackRate = HOLD_PLAYBACK_RATE;
                nextVideo.onended = () => advanceHoldSequence();
                nextVideo.play().catch(() => { });
            } else if (segment.type === "passage") {
                nextVideo.pause();
                try {
                    if (enteringBackward && Number.isFinite(nextVideo.duration) && nextVideo.duration > 0) {
                        const finalFrameTime = Math.max(0, Math.floor(nextVideo.duration * 24 - 1) / 24);
                        nextVideo.currentTime = finalFrameTime;
                        currentPassageFrame = Math.round(finalFrameTime * 24);
                    } else {
                        nextVideo.currentTime = 0;
                        currentPassageFrame = 0;
                    }
                } catch (_) { }
            } else {
                nextVideo.loop = true;
                const baseRate = segment.stage === 0 ? V1L_BASE_PLAYBACK_RATE : OTHER_LOOPS_BASE_PLAYBACK_RATE;
                nextVideo.playbackRate = baseRate;
                nextVideo.defaultPlaybackRate = baseRate;
                nextVideo.onended = () => handleLoopEnded(nextVideo, segment);
                nextVideo.play().catch(() => { });
            }
            nextVideo.classList.add("visible");
            oldVideo.classList.remove("visible");
            activeVideo = nextIndex;
            audioMgr.onSegment(segment.file, nextVideo);

            if (videoFadeTimeout) {
                clearTimeout(videoFadeTimeout);
                videoFadeTimeout = null;
            }
            videoFadeTimeout = window.setTimeout(() => {
                videoFadeTimeout = null;
                if (!destroyed && isActive && oldVideo && oldVideo !== videos[activeVideo]) {
                    oldVideo.pause();
                }
            }, reduced ? 0 : 1050);

            if (loading) loading.classList.add("done");
        };

        nextVideo.pause();
        nextVideo.onloadedmetadata = null;
        if (!(nextVideo.getAttribute("src") || "").endsWith(source)) {
            nextVideo.removeAttribute("src");
            nextVideo.load();
            nextVideo.src = source;
            nextVideo.load();
        }
        if (nextVideo.readyState >= 1 && (nextVideo.getAttribute("src") || "").endsWith(source)) {
            showVideo();
        } else {
            nextVideo.onloadedmetadata = showVideo;
            nextVideo.load();
        }
    }

    function advanceHoldSequence() {
        if (!holdMode || destroyed || !isActive) return;
        const next = activeSegment + 1;
        if (next >= segments.length) {
            const finalVideo = videos[activeVideo];
            if (finalVideo) finalVideo.pause();
            holdMode = false;
            return;
        }
        target = starts[next] + 0.00001;
        smooth = target;
        pendingLoopNext = null;
        allowLoopTransition = true;
        activateSegment(next);
    }

    function cancelTouchHoldTimer() {
        if (touchHoldTimeout !== null) {
            clearTimeout(touchHoldTimeout);
            touchHoldTimeout = null;
        }
    }

    function beginHoldMode(event) {
        if (destroyed || !isActive) return;
        if (event && event.button !== undefined && event.button !== 0) return;
        if (event && event.target && event.target.closest && event.target.closest(".journey-nav, .site-menu, .journey-cta, .logo")) return;
        if (holdMode) return;
        holdMode = true;
        pendingLoopNext = null;
        allowLoopTransition = false;
        const video = videos[activeVideo];
        if (!video) return;
        video.loop = false;
        video.playbackRate = HOLD_PLAYBACK_RATE;
        video.onended = () => advanceHoldSequence();
        if (video.readyState >= 2) video.play().catch(() => { });
    }

    function endHoldMode() {
        cancelTouchHoldTimer();
        if (!holdMode || destroyed || !isActive) return;
        holdMode = false;
        const video = videos[activeVideo];
        if (!video) return;
        video.onended = null;
        const segment = segments[activeSegment];
        if (!segment) return;
        if (segment.type === "passage") {
            video.pause();
            if (Number.isFinite(video.duration) && video.duration > 0) {
                const local = clamp(video.currentTime / video.duration, 0, 0.99999);
                target = starts[activeSegment] + (segments[activeSegment].weight / totalWeight) * local;
                smooth = target;
            }
        } else {
            video.loop = true;
            const baseRate = segment.stage === 0 ? V1L_BASE_PLAYBACK_RATE : OTHER_LOOPS_BASE_PLAYBACK_RATE;
            video.playbackRate = baseRate;
            if (video.ended) {
                try {
                    video.currentTime = 0;
                } catch (_) { }
            }
            video.play().catch(() => { });
        }
    }

    function loopExitWindowOpen() {
        const video = videos[activeVideo];
        if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return false;
        if (video.ended || video.paused) return true;
        const isV1L = segments[activeSegment] && segments[activeSegment].stage === 0;
        if (isV1L) {
            return (video.duration - video.currentTime) <= V1L_LOOP_EXIT_WINDOW_S;
        }
        const rate = video.playbackRate > 0 ? video.playbackRate : 1;
        return (video.duration - video.currentTime) / rate <= OTHER_LOOPS_EXIT_WINDOW_S;
    }

    function advanceVirtualScroll(deltaPixels) {
        if (destroyed || !isActive) return false;
        const seg = segments[activeSegment];
        if (deltaPixels > 0 && seg && seg.type === "loop" && !holdMode && pendingLoopNext === null) {
            lastLoopForwardAt = performance.now();
            lastInputAt = performance.now();
            if (activeSegment + 1 >= segments.length || !loopExitWindowOpen()) return false;
            pendingLoopNext = activeSegment + 1;
            target = starts[pendingLoopNext] + 0.00001;
            smooth = target;
            if (videos[activeVideo]) videos[activeVideo].loop = false;
            return true;
        }
        lastInputAt = performance.now();
        const delta = deltaPixels / (Math.max(500, window.innerHeight) * INPUT_DISTANCE_PER_VIEWPORT);
        target = clamp(target + delta, 0, 0.99999);
        if (pendingLoopNext !== null && delta > 0) {
            target = Math.min(target, starts[pendingLoopNext] + 0.00001);
        }
        return true;
    }

    function handleWheel(event) {
        if (destroyed || !isActive) return;
        event.preventDefault();
        let delta = event.deltaY;
        if (event.deltaMode === 1) delta *= 16;
        if (event.deltaMode === 2) delta *= window.innerHeight;
        const currentSeg = segments[activeSegment];
        if (currentSeg && currentSeg.type === "loop") {
            const isStage0 = currentSeg.stage === 0;
            if (delta > 0) {
                const multiplier = isStage0 ? V1L_SCROLL_SPEED_MULTIPLIER : DEFAULT_LOOP_SCROLL_SPEED_MULTIPLIER;
                const impulse = (Math.abs(delta) / 100) * (multiplier * 0.45);
                loopScrollBoost = Math.min(15.0, loopScrollBoost + impulse);
                lastLoopForwardAt = performance.now();
                lastInputAt = performance.now();
                audioMgr.duck();
                audioMgr.scheduledUnduck();
            } else if (delta < 0) {
                loopScrollBoost = 0;
            }
            const loopMultiplier = isStage0
                ? (delta > 0 ? 0.7 : 0.4)
                : (delta > 0 ? 0.35 : 0.2);
            advanceVirtualScroll(delta * loopMultiplier);
        } else {
            advanceVirtualScroll(delta * WHEEL_SENSITIVITY);
        }
    }

    function handleTouchStart(event) {
        if (destroyed || !isActive) return;
        if (!event.touches.length) return;
        const touch = event.touches[0];
        touchY = touch.clientY;
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchIsScrolling = false;

        cancelTouchHoldTimer();

        if (event.target && event.target.closest && event.target.closest(".journey-nav")) return;

        touchHoldTimeout = setTimeout(() => {
            touchHoldTimeout = null;
            if (!touchIsScrolling && !destroyed && isActive) {
                beginHoldMode({ button: 0, target: event.target });
            }
        }, TOUCH_HOLD_DELAY_MS);
    }

    function handleTouchMove(event) {
        if (destroyed || !isActive) return;
        if (touchY === null || !event.touches.length) return;
        const touch = event.touches[0];
        const dx = Math.abs(touch.clientX - touchStartX);
        const dy = Math.abs(touch.clientY - touchStartY);

        if (dx > TOUCH_MOVE_CANCEL_DIST || dy > TOUCH_MOVE_CANCEL_DIST) {
            cancelTouchHoldTimer();
            if (holdMode) {
                endHoldMode();
            }
            touchIsScrolling = true;
        }

        event.preventDefault();
        const y = touch.clientY;
        const deltaY = touchY - y;
        const currentSeg = segments[activeSegment];
        if (currentSeg && currentSeg.type === "loop") {
            const isStage0 = currentSeg.stage === 0;
            if (deltaY > 0) {
                const multiplier = isStage0 ? V1L_SCROLL_SPEED_MULTIPLIER : DEFAULT_LOOP_SCROLL_SPEED_MULTIPLIER;
                const impulse = (Math.abs(deltaY) / 30) * (multiplier * 0.45);
                loopScrollBoost = Math.min(15.0, loopScrollBoost + impulse);
                lastLoopForwardAt = performance.now();
                lastInputAt = performance.now();
                audioMgr.duck();
                audioMgr.scheduledUnduck();
            } else if (deltaY < 0) {
                loopScrollBoost = 0;
            }
        }
        advanceVirtualScroll(deltaY * TOUCH_SENSITIVITY);
        touchY = y;
    }

    function handleTouchEnd() {
        cancelTouchHoldTimer();
        if (holdMode) {
            endHoldMode();
        }
        touchY = null;
        touchIsScrolling = false;
    }

    function handleTouchCancel() {
        handleTouchEnd();
    }

    function handleKeyDown(event) {
        if (destroyed || !isActive) return;
        if (event.code === "Space" && !event.repeat) {
            event.preventDefault();
            beginHoldMode({
                button: 0,
                target: document.body
            });
            return;
        }
        if (["ArrowDown", "PageDown", " "].includes(event.key)) {
            event.preventDefault();
            const currentSeg = segments[activeSegment];
            if (currentSeg && currentSeg.type === "loop") {
                const isStage0 = currentSeg.stage === 0;
                const multiplier = isStage0 ? V1L_SCROLL_SPEED_MULTIPLIER : DEFAULT_LOOP_SCROLL_SPEED_MULTIPLIER;
                loopScrollBoost = Math.min(15.0, loopScrollBoost + multiplier * 0.75);
                lastLoopForwardAt = performance.now();
                lastInputAt = performance.now();
                audioMgr.duck();
                audioMgr.scheduledUnduck();
            }
            advanceVirtualScroll(event.key === " " ? window.innerHeight * 0.7 : window.innerHeight * 0.35);
        } else if (["ArrowUp", "PageUp"].includes(event.key)) {
            event.preventDefault();
            loopScrollBoost = 0;
            advanceVirtualScroll(-window.innerHeight * 0.35);
        } else if (event.key === "Home") {
            event.preventDefault();
            target = 0;
            loopScrollBoost = 0;
            lastInputAt = performance.now();
        } else if (event.key === "End") {
            event.preventDefault();
            target = 0.99999;
            loopScrollBoost = 0;
            lastInputAt = performance.now();
        }
    }

    function handleKeyUp(event) {
        if (event.code === "Space") endHoldMode();
    }

    function goToStage(stage) {
        if (destroyed || !isActive) return;
        const firstSegment = segments.findIndex(segment => segment.stage === stage);
        if (firstSegment < 0) return;
        pendingLoopNext = null;
        allowLoopTransition = true;
        loopScrollBoost = 0;
        target = starts[firstSegment] + 0.00001;
        smooth = target;
        lastInputAt = performance.now();
        activateSegment(firstSegment);
    }

    function render() {
        if (destroyed || !isActive) return;

        const isPassage = segments[activeSegment] && segments[activeSegment].type === "passage";
        const smoothRate = isPassage ? 0.28 : 0.085;
        smooth += (target - smooth) * (reduced ? 1 : smoothRate);
        if (Math.abs(target - smooth) < 0.00002) smooth = target;
        const desired = segmentAt(smooth);
        let chosen = desired;

        const isLoop = segments[activeSegment] && segments[activeSegment].type === "loop";
        let activeLoopRate = 1.0;
        if (isLoop) {
            const isStage0 = segments[activeSegment].stage === 0;
            const baseRate = isStage0 ? V1L_BASE_PLAYBACK_RATE : OTHER_LOOPS_BASE_PLAYBACK_RATE;
            if (loopScrollBoost > 0.005) {
                loopScrollBoost *= 0.91;
                if (loopScrollBoost < 0.005) loopScrollBoost = 0;
            } else {
                loopScrollBoost = 0;
            }
            activeLoopRate = clamp(baseRate + loopScrollBoost, 0.1, 16.0);
        } else {
            loopScrollBoost = 0;
        }

        if (activeSegment >= 0 && segments[activeSegment].type === "loop" && desired.index > activeSegment && !allowLoopTransition) {
            const nextIdx = activeSegment + 1;
            pendingLoopNext = nextIdx;
            target = Math.min(target, starts[nextIdx] + 0.00001);
            chosen = {
                index: activeSegment,
                local: 1
            };
            const loopVideo = videos[activeVideo];
            if (loopVideo && loopVideo.readyState >= 2) {
                loopVideo.loop = false;
                loopVideo.playbackRate = activeLoopRate;
                if (loopVideo.ended || (Number.isFinite(loopVideo.duration) && loopVideo.duration > 0 && (loopVideo.duration - loopVideo.currentTime) <= 0.2)) {
                    allowLoopTransition = true;
                    target = starts[nextIdx] + 0.00001;
                    smooth = target;
                    chosen = segmentAt(smooth);
                    pendingLoopNext = null;
                } else if (loopVideo.paused) {
                    loopVideo.play().catch(() => { });
                }
            }
        }

        if (activeSegment >= 0 && desired.index < activeSegment) chosen = desired;
        if (chosen.index !== activeSegment) {
            activateSegment(chosen.index);
        }
        const segment = segments[chosen.index];
        const video = videos[activeVideo];
        if (video) {
            if (holdMode) {
                video.loop = false;
                video.playbackRate = HOLD_PLAYBACK_RATE;
                if (video.paused && !video.ended && video.readyState >= 2) video.play().catch(() => { });
            } else if (segment.type === "passage" && video.readyState >= 2 && Number.isFinite(video.duration) && video.duration > 0) {
                const time = clamp(chosen.local * Math.max(0, video.duration - 0.035), 0, video.duration);
                const frameDuration = 1 / 24;
                const targetFrame = Math.round(time / frameDuration);
                const displayedFrame = Math.round(video.currentTime / frameDuration);
                currentPassageFrame = displayedFrame;
                if (!video.seeking && displayedFrame !== targetFrame) {
                    const nextFrame = displayedFrame + Math.sign(targetFrame - displayedFrame);
                    const nextTargetTime = nextFrame * frameDuration;
                    if (Math.abs(video.currentTime - nextTargetTime) >= 0.015) {
                        applyPassageSeek(video, nextTargetTime);
                    }
                }
                if (!video.paused) video.pause();
            } else if (segment.type === "loop") {
                if (chosen.index === desired.index && desired.index === activeSegment && !allowLoopTransition) {
                    video.loop = true;
                    video.playbackRate = activeLoopRate;
                    if (video.paused && video.readyState >= 2) video.play().catch(() => { });
                    audioMgr.syncWatchdog(video);
                }
            }
        }
        if (allowLoopTransition) {
            allowLoopTransition = false;
        }
        const isAtInitialStage = smooth < 0.015 && activeSegment === 0;
        const isPromptVisible = isAtInitialStage && (performance.now() - lastInputAt > PROMPT_IDLE_FADE_MS);
        const nextPromptState = isPromptVisible ? "visible" : "hidden";
        if (lastPromptOpacity !== nextPromptState && prompt) {
            prompt.style.opacity = isPromptVisible ? "1" : "0";
            prompt.style.pointerEvents = isPromptVisible ? "auto" : "none";
            prompt.classList.toggle("is-hidden", !isPromptVisible);
            lastPromptOpacity = nextPromptState;
        }

        if (!destroyed && isActive) {
            renderRafId = requestAnimationFrame(render);
        }
    }

    function destroy() {
        if (destroyed && !isActive) return;
        destroyed = true;
        isActive = false;

        // 1. Remove all registered event listeners
        eventManager.removeAll();

        // 2. Cancel animation frame loop
        if (renderRafId) {
            cancelAnimationFrame(renderRafId);
            renderRafId = null;
        }

        // 3. Clear timers
        if (copyAnimTimer) {
            clearTimeout(copyAnimTimer);
            copyAnimTimer = null;
        }
        if (videoFadeTimeout) {
            clearTimeout(videoFadeTimeout);
            videoFadeTimeout = null;
        }
        cancelTouchHoldTimer();

        // 4. Pause and unload videos
        if (videos && videos.length) {
            videos.forEach(v => {
                if (v) {
                    try {
                        v.pause();
                        v.onended = null;
                        v.onloadedmetadata = null;
                        v.removeAttribute("src");
                        v.load();
                    } catch (_) { }
                }
            });
        }

        // 5. Clean up audio manager
        if (typeof audioMgr !== "undefined" && audioMgr.destroy) {
            audioMgr.destroy();
        }

        loopScrollBoost = 0;
        holdMode = false;
        touchY = null;
        touchIsScrolling = false;
    }

    function boot() {
        queryDOMElements();

        // If required DOM elements are absent (not on homepage), bail out
        if (!videos[0] || !videos[1] || !experience) {
            return;
        }

        // Guard against duplicate initialization on active instance
        if (isActive && !destroyed) {
            return;
        }

        // Clean up any stale state first
        destroy();

        destroyed = false;
        isActive = true;

        // Reset runtime values
        activeVideo = 0;
        activeSegment = 0;
        target = 0;
        smooth = 0;
        currentPassageFrame = 0;
        lastFrameStepTime = 0;
        lastInputAt = -Infinity;
        lastLoopForwardAt = -Infinity;
        allowLoopTransition = false;
        pendingLoopNext = null;
        loadToken = 0;
        touchY = null;
        wheelAccumulator = 0;
        holdMode = false;
        loopScrollBoost = 0;
        lastPromptOpacity = "";

        // Register video seeked listeners
        videos.forEach(v => {
            if (!v) return;
            eventManager.add(v, "seeked", () => {
                if (destroyed || !isActive) return;
                if (v === videos[activeVideo] && segments[activeSegment] && segments[activeSegment].type === "passage") {
                    currentPassageFrame = Math.round(v.currentTime * 24);
                }
            });
        });

        // Pointer down on experience
        eventManager.add(experience, "pointerdown", (e) => {
            if (destroyed || !isActive) return;
            audioMgr.unlock();
            if (e.pointerType === "mouse" || e.pointerType === "pen") {
                beginHoldMode(e);
            }
        });

        // Audio unlock gestures
        const unlockAudio = () => audioMgr.unlock();
        eventManager.add(window, "wheel", unlockAudio, { once: true, passive: true });
        eventManager.add(window, "keydown", unlockAudio, { once: true });
        eventManager.add(window, "touchstart", unlockAudio, { once: true, passive: true });

        // Pointer up / cancel / blur
        eventManager.add(window, "pointerup", (e) => {
            if (destroyed || !isActive) return;
            if (!e.pointerType || e.pointerType === "mouse" || e.pointerType === "pen") {
                endHoldMode();
            }
        });
        eventManager.add(window, "pointercancel", endHoldMode);
        eventManager.add(window, "blur", endHoldMode);

        // Wheel scrolling
        eventManager.add(window, "wheel", handleWheel, { passive: false });

        // Touch events
        eventManager.add(window, "touchstart", handleTouchStart, { passive: true });
        eventManager.add(window, "touchmove", handleTouchMove, { passive: false });
        eventManager.add(window, "touchend", handleTouchEnd, { passive: true });
        eventManager.add(window, "touchcancel", handleTouchCancel, { passive: true });

        // Keyboard events
        eventManager.add(window, "keydown", handleKeyDown);
        eventManager.add(window, "keyup", handleKeyUp);

        // Stage navigation dots
        if (dots && dots.length) {
            dots.forEach(dot => {
                if (!dot) return;
                eventManager.add(dot, "click", (e) => {
                    if (destroyed || !isActive) return;
                    e.stopPropagation();
                    goToStage(Number(dot.dataset.stage));
                });
            });
        }

        // Scroll prompt click
        if (prompt) {
            eventManager.add(prompt, "click", () => {
                if (destroyed || !isActive) return;
                const currentSeg = segments[activeSegment];
                if (currentSeg && currentSeg.type === "loop") {
                    const isStage0 = currentSeg.stage === 0;
                    const multiplier = isStage0 ? V1L_SCROLL_SPEED_MULTIPLIER : DEFAULT_LOOP_SCROLL_SPEED_MULTIPLIER;
                    loopScrollBoost = Math.min(15.0, loopScrollBoost + multiplier * 0.9);
                    lastLoopForwardAt = performance.now();
                    lastInputAt = performance.now();
                    audioMgr.duck();
                    audioMgr.scheduledUnduck();
                }
                advanceVirtualScroll(window.innerHeight * 0.35);
            });
        }

        if (prompt) {
            prompt.style.opacity = "1";
            prompt.style.pointerEvents = "auto";
            prompt.classList.remove("is-hidden");
        }

        const first = videos[0];
        const second = videos[1];
        if (second) {
            second.classList.remove("visible");
            second.pause();
            second.removeAttribute("src");
            second.load();
        }

        first.src = `/assets/master/${segments[0].file}`;
        first.loop = true;
        first.playbackRate = V1L_BASE_PLAYBACK_RATE;
        first.defaultPlaybackRate = V1L_BASE_PLAYBACK_RATE;
        first.onended = () => handleLoopEnded(first, segments[0]);
        first.load();
        first.play().catch(() => { });
        first.classList.add("visible");

        if (loading) loading.classList.add("done");

        if (renderRafId) cancelAnimationFrame(renderRafId);
        renderRafId = requestAnimationFrame(render);
    }

    boot();
    window.__blueScrollyDestroy = destroy;
    window.__blueScrollyInit = boot;
})();
