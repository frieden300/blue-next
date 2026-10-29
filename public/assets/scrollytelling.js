(() => {
    "use strict";
    // Custom virtual scrolling: the browser's scrollbar is not used.
    // All filenames below match the user's master folder exactly.
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
    const videos = [document.querySelector("#videoA"), document.querySelector("#videoB")];
    let pendingPassageSeek = null;
    // Request a single frame seek. If the browser is already seeking, wait for
    // that seek to finish; render() will request the next intermediate frame.
    function applyPassageSeek(video, targetTime) {
        if (!video || video.seeking) return;
        if (Math.abs(video.currentTime - targetTime) < 0.015) return;
        try {
            video.currentTime = targetTime;
        } catch (_) { }
    }
    // Never jump straight to a newer target on seeked. render() advances one
    // 24fps frame at a time until it catches up with the scroll target.
    videos.forEach(v => {
        v.addEventListener("seeked", () => {
            if (v === videos[activeVideo] && segments[activeSegment] && segments[activeSegment].type === "passage") {
                currentPassageFrame = Math.round(v.currentTime * 24);
            }
        });
    });

    const copy = document.querySelector(".copy");
    const eyebrow = document.querySelector("#eyebrow");
    const heading = document.querySelector("#heading");
    const description = document.querySelector("#description");
    const stageName = document.querySelector("#stageName");
    const modeLabel = document.querySelector("#modeLabel");
    const number = document.querySelector("#progressNumber");
    const loading = document.querySelector("#loading");
    const prompt = document.querySelector("#scrollPrompt");
    const particles = document.querySelector("#particles");
    const dots = [...document.querySelectorAll(".journey-nav button")];
    const journeyCta = document.querySelector("#journeyCta");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
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
    const HOLD_PLAYBACK_RATE = 2.5; // Change this to tune hold-to-watch playback speed.

    // ─── LOOP PLAYBACK & SCROLL FAST-FORWARD TUNING ───────────────────────────
    const V1L_BASE_PLAYBACK_RATE = 1.2;             // Idle loop speed for V1L (segment 0) when not scrolling
    const OTHER_LOOPS_BASE_PLAYBACK_RATE = 1.0;     // Idle loop speed for all other loops when not scrolling
    const V1L_SCROLL_SPEED_MULTIPLIER = 3.0;        // Controls scroll fast-forward speed for V1L (14s video)
    const DEFAULT_LOOP_SCROLL_SPEED_MULTIPLIER = 2.0; // Controls scroll fast-forward speed for 4s loops
    const V1L_PLAYBACK_RATE = V1L_BASE_PLAYBACK_RATE; // Backward-compatibility alias
    const LOOP_SCROLL_RATE = DEFAULT_LOOP_SCROLL_SPEED_MULTIPLIER; // Backward-compatibility alias

    let loopScrollBoost = 0; // Dynamic scroll acceleration for loops, smoothly decays in render()
    const SCROLL_IDLE_MS = 260;

    // ─── LOOP EXIT WINDOW TUNING (SECONDS) ────────────────────────────────────
    // A forward scroll on a loop video only counts if the loop is within this many
    // seconds (real time) of finishing. Earlier scrolls fast-forward/accelerate the loop.
    const V1L_LOOP_EXIT_WINDOW_S = 0.3;             // Exit window for V1L (segment 0 / 14s video)
    const OTHER_LOOPS_EXIT_WINDOW_S = 0.3;         // Exit window for all other 4s loop segments
    const LOOP_EXIT_WINDOW_S = OTHER_LOOPS_EXIT_WINDOW_S; // Backward-compatibility alias
    let copyAnimTimer = null;
    let lastPromptOpacity = "";
    let renderRafId = null;
    let destroyed = false;
    // Approx. one full viewport-height worth of input moves a little over one segment.
    // Change this value if the journey feels too fast or too slow.
    const INPUT_DISTANCE_PER_VIEWPORT = 1.0;
    // Mouse-wheel sensitivity: lower = fewer video frames advanced per wheel notch.
    // Try 0.025 first; 0.01 is very precise, 0.05 is faster.
    const WHEEL_SENSITIVITY = 0.025;
    // Touch/mobile swipe sensitivity: lower = slower, less sensitive swipe.
    // Default is 0.5 (half speed). Adjust between 0.2 and 1.0 to taste without altering desktop wheel.
    const TOUCH_SENSITIVITY = 0.04;
    const totalWeight = segments.reduce((sum, segment) => sum + segment.weight, 0);
    const starts = [];
    let weightSum = 0;
    segments.forEach(segment => {
        starts.push(weightSum / totalWeight);
        weightSum += segment.weight;
    });
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const scrollingRecently = () => performance.now() - lastInputAt < SCROLL_IDLE_MS;
    const loopScrollingRecently = () => performance.now() - lastLoopForwardAt < SCROLL_IDLE_MS;

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
            if (ctaTitle) ctaTitle.textContent = segment.stage === 6 ? "Explore beyond the abyss" : "Explore the ocean";
            cta.setAttribute("aria-hidden", String(!(segment.stage === 0 || segment.stage === 6)));
            cta.tabIndex = (segment.stage === 0 || segment.stage === 6) ? 0 : -1;
        }

        if (copyAnimTimer) clearTimeout(copyAnimTimer);

        if (reduced) {
            eyebrow.textContent = segment.eyebrow;
            heading.innerHTML = segment.title;
            description.textContent = segment.description;
        } else {
            // Smooth exit: fade out and glide upward with subtle blur
            copy.classList.remove("entering");
            copy.classList.add("changing");
            copyAnimTimer = setTimeout(() => {
                // Swap text while completely invisible
                eyebrow.textContent = segment.eyebrow;
                heading.innerHTML = segment.title;
                description.textContent = segment.description;

                // Setup enter from below without transition
                copy.classList.remove("changing");
                copy.classList.add("entering");
                void copy.offsetWidth; // Force layout reflow

                // Animate smoothly to resting position
                copy.classList.remove("entering");
            }, 300);
        }

        stageName.textContent = segment.name;
        modeLabel.textContent = segment.mode;
        number.textContent = String(segment.stage + 1).padStart(2, "0");
        dots.forEach((dot, i) => dot.classList.toggle("active", i === segment.stage));
        particles.classList.toggle("on", segment.stage >= 3);
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
        // Restart synced audio in phase with video reset
        audioMgr.onLoopRestart(video);
    }

    function handleLoopEnded(video, segment) {
        // A loop can hand off to its next segment when scrolling forwards or when next segment is queued
        const wantsNext = (pendingLoopNext === activeSegment + 1) || (segmentAt(target).index > activeSegment);
        if (wantsNext && activeSegment + 1 < segments.length) {
            allowLoopTransition = true;
            target = starts[activeSegment + 1] + 0.00001;
            smooth = target;
            pendingLoopNext = null;
            return;
        }
        // If user is not scrolling forward, stay in this scene and loop
        pendingLoopNext = null;
        allowLoopTransition = false;
        target = starts[activeSegment] + 0.00001;
        smooth = target;
        restartLoop(video, segment);
    }

    function activateSegment(index) {
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
        // Entering a loop going forward starts fresh: drop any scroll overshoot carried
        // over from the previous passage so it can't queue an instant exit.
        if (segment.type === "loop" && !enteringBackward) {
            target = starts[index] + 0.00001;
            smooth = target;
            loopScrollBoost = 0;
        }
        updateCopy(index);
        const showVideo = () => {
            if (token !== loadToken) return;
            nextVideo.onended = null;
            nextVideo.loop = false;
            if (holdMode) {
                // Hold-to-watch mode: every clip plays once, including passage clips.
                nextVideo.loop = false;
                nextVideo.playbackRate = HOLD_PLAYBACK_RATE;
                nextVideo.onended = () => advanceHoldSequence();
                nextVideo.play().catch(() => { });
            } else if (segment.type === "passage") {
                nextVideo.pause();
                // Re-entering a passage from a later segment while moving backward
                // should start at the final 24fps frame, then scrub backward toward
                // the requested position instead of restarting from frame zero.
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
            // Trigger audio crossfade to match the new segment
            audioMgr.onSegment(segment.file, nextVideo);
            window.setTimeout(() => {
                if (oldVideo !== videos[activeVideo]) oldVideo.pause();
            }, reduced ? 0 : 1050);
            loading.classList.add("done");
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
        if (!holdMode) return;
        const next = activeSegment + 1;
        if (next >= segments.length) {
            // End of the journey: stop at the final frame rather than looping.
            const finalVideo = videos[activeVideo];
            finalVideo.pause();
            holdMode = false;
            return;
        }
        target = starts[next] + 0.00001;
        smooth = target;
        pendingLoopNext = null;
        allowLoopTransition = true;
        activateSegment(next);
    }

    let touchHoldTimeout = null;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchIsScrolling = false;
    const TOUCH_HOLD_DELAY_MS = 380;
    const TOUCH_MOVE_CANCEL_DIST = 10;

    function cancelTouchHoldTimer() {
        if (touchHoldTimeout !== null) {
            clearTimeout(touchHoldTimeout);
            touchHoldTimeout = null;
        }
    }

    function beginHoldMode(event) {
        if (event && event.button !== undefined && event.button !== 0) return;
        if (event && event.target && event.target.closest && event.target.closest(".journey-nav, .site-menu, .journey-cta, .logo")) return;
        if (holdMode) return;
        holdMode = true;
        pendingLoopNext = null;
        allowLoopTransition = false;
        const video = videos[activeVideo];
        video.loop = false;
        video.playbackRate = HOLD_PLAYBACK_RATE;
        video.onended = () => advanceHoldSequence();
        // In hold mode the current clip plays from the frame currently visible.
        if (video.readyState >= 2) video.play().catch(() => { });
    }

    function endHoldMode() {
        cancelTouchHoldTimer();
        if (!holdMode) return;
        holdMode = false;
        const video = videos[activeVideo];
        video.onended = null;
        const segment = segments[activeSegment];
        if (segment.type === "passage") {
            video.pause();
            if (Number.isFinite(video.duration) && video.duration > 0) {
                const local = clamp(video.currentTime / video.duration, 0, 0.99999);
                target = starts[activeSegment] + (segments[activeSegment].weight / totalWeight) * local;
                smooth = target;
            }
        } else {
            // Restore the ordinary ambient loop behavior when the pointer is released.
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

    const experience = document.querySelector(".experience");

    // Desktop mouse pointer handling: immediately trigger hold-to-watch on left mouse button.
    // Touch pointers are handled via touchstart with a long-press timer so touch scrolling is not blocked.
    experience.addEventListener("pointerdown", (e) => {
        audioMgr.unlock(); // first gesture unlocks AudioContext
        if (e.pointerType === "mouse" || e.pointerType === "pen") {
            beginHoldMode(e);
        }
    });

    // Also unlock on first wheel/key gesture (no pointer needed)
    window.addEventListener("wheel", () => audioMgr.unlock(), {
        once: true,
        passive: true
    });
    window.addEventListener("keydown", () => audioMgr.unlock(), {
        once: true
    });
    window.addEventListener("touchstart", () => audioMgr.unlock(), {
        once: true,
        passive: true
    });

    window.addEventListener("pointerup", (e) => {
        if (!e.pointerType || e.pointerType === "mouse" || e.pointerType === "pen") {
            endHoldMode();
        }
    });
    window.addEventListener("pointercancel", endHoldMode);
    window.addEventListener("blur", endHoldMode);

    // True when the active loop video will finish within exit window of real time.
    function loopExitWindowOpen() {
        const video = videos[activeVideo];
        if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return false;
        // Paused/blocked video can never reach its end, so don't lock the user in.
        if (video.ended || video.paused) return true;
        const isV1L = segments[activeSegment] && segments[activeSegment].stage === 0;
        if (isV1L) {
            // For V1L (14s video), check the exact video seconds remaining directly against V1L_LOOP_EXIT_WINDOW_S.
            // Do NOT divide by accelerated playbackRate, which previously inflated a 0.3s window to 3-4s during scrolling.
            return (video.duration - video.currentTime) <= V1L_LOOP_EXIT_WINDOW_S;
        }
        const rate = video.playbackRate > 0 ? video.playbackRate : 1;
        return (video.duration - video.currentTime) / rate <= OTHER_LOOPS_EXIT_WINDOW_S;
    }

    // Returns true if the input was used, false if it was ignored.
    function advanceVirtualScroll(deltaPixels) {
        const seg = segments[activeSegment];
        if (deltaPixels > 0 && seg && seg.type === "loop" && !holdMode && pendingLoopNext === null) {
            lastLoopForwardAt = performance.now();
            lastInputAt = performance.now();
            // Forward scroll on a loop: only valid near the end of the loop.
            if (activeSegment + 1 >= segments.length || !loopExitWindowOpen()) return false;
            // Commit now: stop looping, finish this playback, then hand off to the next segment.
            pendingLoopNext = activeSegment + 1;
            target = starts[pendingLoopNext] + 0.00001;
            smooth = target;
            videos[activeVideo].loop = false;
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
    // Intercept wheel scrolling so there is no finite browser scrollbar to run out of.
    window.addEventListener("wheel", event => {
        event.preventDefault();
        let delta = event.deltaY;
        if (event.deltaMode === 1) delta *= 16;
        if (event.deltaMode === 2) delta *= window.innerHeight;
        const currentSeg = segments[activeSegment];
        if (currentSeg && currentSeg.type === "loop") {
            const isStage0 = currentSeg.stage === 0;
            if (delta > 0) {
                // Forward scroll boosts loop playbackRate smoothly
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
            // Precise frame-level control for passage videos
            advanceVirtualScroll(delta * WHEEL_SENSITIVITY);
        }
    }, {
        passive: false
    });
    // Touch support for phones/tablets.
    window.addEventListener("touchstart", event => {
        if (!event.touches.length) return;
        const touch = event.touches[0];
        touchY = touch.clientY;
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchIsScrolling = false;

        // Cancel any existing long-press timer
        cancelTouchHoldTimer();

        // If user tapped navigation, do not trigger hold mode
        if (event.target && event.target.closest && event.target.closest(".journey-nav")) return;

        // Start long-press timer: if touch stays stationary for TOUCH_HOLD_DELAY_MS, enter hold mode
        touchHoldTimeout = setTimeout(() => {
            touchHoldTimeout = null;
            if (!touchIsScrolling) {
                beginHoldMode({ button: 0, target: event.target });
            }
        }, TOUCH_HOLD_DELAY_MS);
    }, {
        passive: true
    });

    window.addEventListener("touchmove", event => {
        if (touchY === null || !event.touches.length) return;
        const touch = event.touches[0];
        const dx = Math.abs(touch.clientX - touchStartX);
        const dy = Math.abs(touch.clientY - touchStartY);

        // If user moved finger beyond cancel threshold, it is a scroll gesture:
        // cancel long-press hold timer and exit hold mode if already triggered.
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
    }, {
        passive: false
    });

    window.addEventListener("touchend", () => {
        cancelTouchHoldTimer();
        if (holdMode) {
            endHoldMode();
        }
        touchY = null;
        touchIsScrolling = false;
    }, {
        passive: true
    });

    window.addEventListener("touchcancel", () => {
        cancelTouchHoldTimer();
        if (holdMode) {
            endHoldMode();
        }
        touchY = null;
        touchIsScrolling = false;
    }, {
        passive: true
    });
    window.addEventListener("keydown", event => {
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
    });
    window.addEventListener("keyup", event => {
        if (event.code === "Space") endHoldMode();
    });

    function goToStage(stage) {
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
    dots.forEach(dot => {
        dot.addEventListener("click", (e) => {
            e.stopPropagation();
            goToStage(Number(dot.dataset.stage));
        });
    });

    if (prompt) {
        prompt.addEventListener("click", () => {
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

    function render() {
        if (destroyed) return;
        // Smooth the virtual position. Passage videos use higher responsiveness for immediate 24fps feedback.
        const isPassage = segments[activeSegment] && segments[activeSegment].type === "passage";
        const smoothRate = isPassage ? 0.28 : 0.085;
        smooth += (target - smooth) * (reduced ? 1 : smoothRate);
        if (Math.abs(target - smooth) < 0.00002) smooth = target;
        const desired = segmentAt(smooth);
        let chosen = desired;

        // Calculate loop playback rate with smooth boost decay
        const isLoop = segments[activeSegment] && segments[activeSegment].type === "loop";
        let activeLoopRate = 1.0;
        if (isLoop) {
            const isStage0 = segments[activeSegment].stage === 0;
            const baseRate = isStage0 ? V1L_BASE_PLAYBACK_RATE : OTHER_LOOPS_BASE_PLAYBACK_RATE;
            // Decay boost smoothly on each frame (approx 0.91 damping per 16ms frame)
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

        // Forward movement out of a loop waits for its end, then advances exactly one segment.
        if (activeSegment >= 0 && segments[activeSegment].type === "loop" && desired.index > activeSegment && !allowLoopTransition) {
            const nextIdx = activeSegment + 1;
            pendingLoopNext = nextIdx;
            target = Math.min(target, starts[nextIdx] + 0.00001);
            chosen = {
                index: activeSegment,
                local: 1
            };
            const loopVideo = videos[activeVideo];
            if (loopVideo.readyState >= 2) {
                loopVideo.loop = false; // finish this playback once, then hand off
                loopVideo.playbackRate = activeLoopRate;
                // If scrolling forward and the video is already near the end (or ended), transition immediately
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
        // Backward navigation is immediate so the journey remains reversible.
        if (activeSegment >= 0 && desired.index < activeSegment) chosen = desired;
        if (chosen.index !== activeSegment) {
            activateSegment(chosen.index);
        }
        const segment = segments[chosen.index];
        const video = videos[activeVideo];
        if (holdMode) {
            video.loop = false;
            video.playbackRate = HOLD_PLAYBACK_RATE;
            if (video.paused && !video.ended && video.readyState >= 2) video.play().catch(() => { });
        } else if (segment.type === "passage" && video.readyState >= 2 && Number.isFinite(video.duration) && video.duration > 0) {
            const time = clamp(chosen.local * Math.max(0, video.duration - 0.035), 0, video.duration);
            // Quantize to true 24fps frames (1/24s = ~0.04167s) so seeking only occurs when reaching a new frame
            const frameDuration = 1 / 24;
            const targetFrame = Math.round(time / frameDuration);
            const displayedFrame = Math.round(video.currentTime / frameDuration);
            // Advance only one frame per completed seek. If scrolling changes
            // the target from A to C, frames between A and C are requested in order.
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
                // Drift-correction for synced loop audio
                audioMgr.syncWatchdog(video);
            }
        }
        if (allowLoopTransition) {
            allowLoopTransition = false;
            // The next frame sees the desired scroll position and activates the next segment.
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
        renderRafId = requestAnimationFrame(render);
    }

    function destroy() {
        destroyed = true;
        loopScrollBoost = 0;
        if (renderRafId) {
            cancelAnimationFrame(renderRafId);
            renderRafId = null;
        }
        if (copyAnimTimer) {
            clearTimeout(copyAnimTimer);
            copyAnimTimer = null;
        }
        videos.forEach(v => {
            if (v) {
                try {
                    v.pause();
                    v.removeAttribute("src");
                    v.load();
                } catch (_) { }
            }
        });
        if (typeof audioMgr !== "undefined" && audioMgr.destroy) {
            audioMgr.destroy();
        }
    }

    function boot() {
        destroyed = false;
        loopScrollBoost = 0;
        lastInputAt = -Infinity;
        lastPromptOpacity = "";
        if (prompt) {
            prompt.style.opacity = "1";
            prompt.style.pointerEvents = "auto";
            prompt.classList.remove("is-hidden");
        }
        const first = videos[0];
        first.src = `/assets/master/${segments[0].file}`;
        first.loop = true;
        first.playbackRate = V1L_BASE_PLAYBACK_RATE;
        first.defaultPlaybackRate = V1L_BASE_PLAYBACK_RATE;
        first.onended = () => handleLoopEnded(first, segments[0]);
        first.load();
        first.play().catch(() => { });
        first.classList.add("visible");
        loading.classList.add("done");
        if (renderRafId) cancelAnimationFrame(renderRafId);
        renderRafId = requestAnimationFrame(render);
    }
    boot();
    window.__blueScrollyDestroy = destroy;
    window.__blueScrollyInit = boot;
})();

// ─── AUDIO MANAGER ───────────────────────────────────────────────────────
//
// Segment audio map:
//   file key      → { src, sync: bool, videoFile }
//
//   "V4Lds"       → V4LA.mp3,     synced to V4Lds.mp4    (4.46 s)
//   "V5.14Lds"    → V5and8LA.mp3, free loop               (8 s)
//   "V6Lds_s27"   → V6LA.mp3,     synced to V6Lds_s27.mp4 (4.46 s)
//   "V8Lds_b"     → V5and8LA.mp3, free loop               (8 s)
//   all others    → no scene audio
//   VBM.mp3       → always on background music
//
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
// Background music disabled per Issue #10: VBM.mp3 removed; ocean and underwater SFX preserved.
const FADE_S = 0.55; // crossfade duration in seconds
const BG_VOL = 0.18; // background music target volume (legacy reference)
const SCENE_VOL = 0.82; // scene audio target volume
const DUCK_VOL = 0.25; // scene audio volume when fast-forwarding
const SCENE_IDLE_MS = 350; // ms after scroll stops before unduck
const audioMgr = (() => {
    let ctx = null; // AudioContext, created on first gesture
    let unlocked = false;
    // Per-track state: each is { buf, src:AudioBufferSourceNode|null, gain:GainNode }
    let bgTrack = null;
    let sceneTrack = null; // currently playing scene
    let pendingKey = null; // segment file key for current segment
    let duckTimer = null;
    let isDucked = false;
    // Buffer cache so each file is decoded only once
    const bufCache = Object.create(null);

    function getCtx() {
        if (!ctx) {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return ctx;
    }

    function fetchBuf(src) {
        if (bufCache[src]) return bufCache[src];
        bufCache[src] = fetch(src).then(r => r.arrayBuffer()).then(ab => getCtx().decodeAudioData(ab));
        return bufCache[src];
    }
    // Ramp a GainNode smoothly
    function ramp(gainNode, toVal, durationS) {
        const ac = getCtx();
        gainNode.gain.cancelScheduledValues(ac.currentTime);
        gainNode.gain.setValueAtTime(gainNode.gain.value, ac.currentTime);
        gainNode.gain.linearRampToValueAtTime(toVal, ac.currentTime + durationS);
    }
    // Create a looping source connected to a gain node
    function makeLoop(buf, gainNode, startOffset) {
        const src = getCtx().createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.connect(gainNode);
        src.start(0, startOffset % buf.duration);
        return src;
    }

    function startBg() {
        // Disabled per Issue #10: Background music removed; ocean & underwater SFX preserved.
    }
    // Stop the current scene audio with a fade-out, then call cb when done
    function stopScene(cb) {
        if (!sceneTrack) {
            if (cb) cb();
            return;
        }
        const old = sceneTrack;
        sceneTrack = null;
        ramp(old.gain, 0, FADE_S);
        setTimeout(() => {
            try {
                old.src.stop();
            } catch (_) { }
            if (cb) cb();
        }, FADE_S * 1000 + 50);
    }
    // Kick off the scene audio for the given segment file-key
    function startScene(key, videoEl) {
        const def = SEGMENT_AUDIO[key];
        if (!def) return; // no scene audio for this segment
        fetchBuf(def.src).then(buf => {
            if (pendingKey !== key) return; // segment changed while loading
            const ac = getCtx();
            const gain = ac.createGain();
            gain.gain.setValueAtTime(0, ac.currentTime);
            gain.connect(ac.destination);
            let offset = 0;
            if (def.sync && videoEl && Number.isFinite(videoEl.currentTime)) {
                // Sync audio phase to video's current position
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
        });
    }
    // Called by activateSegment whenever the visible segment changes
    function onSegment(segmentFileKey, videoEl) {
        if (!unlocked) return;
        const key = segmentFileKey.replace(/\.mp4$/i, "").split("/").pop().replace(/^.*\//, "");
        pendingKey = key;
        if (sceneTrack && sceneTrack.key === key) return; // same scene, keep playing
        stopScene(() => {
            if (pendingKey === key) startScene(key, videoEl);
        });
    }
    // Keep synced audio in phase with the looping video (call every render frame)
    function syncFrame(videoEl) {
        if (!sceneTrack || !sceneTrack.def.sync || !videoEl) return;
        if (!Number.isFinite(videoEl.currentTime)) return;
        const buf = sceneTrack.buf;
        // If playback rate jumped (fast-forward) re-sync by restarting at video position
        // We detect a >0.5 s phase drift to avoid seeking on minor float differences
        const ac = getCtx();
        // Approximate audio phase: AudioBufferSource doesn't expose currentTime,
        // so we track it via a reference stored at start
        // (drift correction only for synced tracks via watchdog below)
    }
    // Watchdog: called from render() when on a synced loop segment.
    // Restarts audio in-phase with the video if drift > threshold.
    let lastSyncCheck = 0;

    function syncWatchdog(videoEl) {
        if (!sceneTrack || !sceneTrack.def.sync || !videoEl) return;
        if (!Number.isFinite(videoEl.currentTime) || !videoEl.duration) return;
        const now = performance.now();
        if (now - lastSyncCheck < 1500) return; // only check every 1.5 s
        lastSyncCheck = now;
        // If audio src was restarted from wrong offset we'll just let it drift;
        // for a fully correct sync we restart the source to match video phase.
        const ac = getCtx();
        const buf = sceneTrack.buf;
        // We track our own "audio started at" wall-clock reference
        if (sceneTrack._startedAtAcTime !== undefined) {
            const elapsed = ac.currentTime - sceneTrack._startedAtAcTime;
            const audioPhase = (sceneTrack._startOffset + elapsed) % buf.duration;
            const videoPhase = videoEl.currentTime % buf.duration;
            const drift = Math.abs(audioPhase - videoPhase);
            if (drift > 0.12) { // > 120 ms drift → re-sync
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
    // Override makeLoop to record ac start time for the watchdog
    const _origMakeLoop = makeLoop;

    function makeLoopTracked(buf, gainNode, startOffset) {
        const src = getCtx().createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.connect(gainNode);
        src.start(0, startOffset % buf.duration);
        return src;
    }
    // Called whenever loop restarts (handleLoopEnded → restartLoop)
    function onLoopRestart(videoEl) {
        if (!sceneTrack || !sceneTrack.def.sync) return;
        // Restart audio from offset=0 to match video restart
        const buf = sceneTrack.buf;
        const gain = sceneTrack.gain;
        try {
            sceneTrack.src.stop();
        } catch (_) { }
        const ac = getCtx();
        const src = makeLoopTracked(buf, gain, 0);
        sceneTrack.src = src;
        sceneTrack._startedAtAcTime = ac.currentTime;
        sceneTrack._startOffset = 0;
    }
    // Duck/unduck scene audio during fast-forward scroll
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
    // First user gesture unlocks AudioContext and resumes audio graph
    function unlock() {
        if (unlocked) return;
        unlocked = true;
        getCtx().resume().then(() => {
            // Background music removed per Issue #10.
            // If currently on an audio-enabled scene, trigger it
            if (typeof segments !== "undefined" && typeof activeSegment !== "undefined") {
                const seg = segments[activeSegment];
                if (seg && typeof videos !== "undefined" && videos[activeVideo]) {
                    onSegment(seg.file, videos[activeVideo]);
                }
            }
        });
    }

    function destroy() {
        stopScene();
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
// ─── END AUDIO MANAGER ───────────────────────────────────────────────────