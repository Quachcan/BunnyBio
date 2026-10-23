// js/script.js

// How long the loading screen (bounce + text fill) plays before the avatar
// leaps into place. Both the CSS text-fill animation and the JS timer below
// read from this single value so they can never drift out of sync.
const LOADING_DURATION_MS = 2000;
// How long the avatar takes to travel into place and then grow to full size.
const MORPH_DURATION_MS = 1100;
// Pause after the avatar has fully landed, before the page starts revealing —
// a little breathing room instead of revealing the instant it arrives.
const REVEAL_DELAY_MS = 750;
// How long the circular "iris" reveal (radiating out from the avatar) takes.
const REVEAL_DURATION_MS = 900;
// How much bigger the tracked hole is than the avatar's own silhouette —
// enough to see a ring of the real background around it while it bounces.
const HOLE_PADDING_PX = 26;
document.documentElement.style.setProperty("--loading-duration", `${LOADING_DURATION_MS / 1000}s`);
document.documentElement.style.setProperty("--reveal-duration", `${REVEAL_DURATION_MS / 1000}s`);

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// Bật/tắt bởi script trong <head> (theo ngày, hoặc ?theme=halloween)
const isHalloween = document.documentElement.classList.contains("halloween");

let holeTrackingRAF = null;

// Tells the failsafe timer in <head> that the entrance is running, so it
// doesn't yank the overlay away mid-animation.
window.__bioEntranceStarted = true;

// Start right away instead of on window "load": "load" waits for every image
// (QR codes included) and every CDN script, which could leave visitors staring
// at the loading screen for a long time — or forever if a CDN hangs.
// This script sits at the end of <body>, so all the elements already exist.
(() => {
    const overlay = document.getElementById("entrance-overlay");
    const backdrop = overlay.querySelector(".entrance-backdrop");
    const entranceLogo = document.querySelector(".entrance-logo");

    // The <head> failsafe already gave up on us (this file took >4s to arrive)
    // and showed the page without the animation — nothing left to do.
    if (!document.documentElement.classList.contains("js") || !entranceLogo) return;

    if (prefersReducedMotion) {
        skipEntrance(overlay, entranceLogo);
        return;
    }

    startHoleTracking(backdrop, entranceLogo);

    let finished = false;
    const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        overlay.removeEventListener("click", finish);
        document.removeEventListener("keydown", finish);
        finishEntrance(overlay, backdrop, entranceLogo);
    };

    const timer = setTimeout(finish, LOADING_DURATION_MS);
    // Tap/click/any key skips the rest of the loading screen.
    overlay.addEventListener("click", finish);
    document.addEventListener("keydown", finish);
})();

/**
 * No animation at all: put the avatar in its final home, drop the overlay and
 * show the page. Used for reduced-motion visitors and browsers without WAAPI.
 */
function skipEntrance(overlay, entranceLogo) {
    stopHoleTracking();
    const avatarWrapper = document.querySelector(".avatar-wrapper");
    if (entranceLogo && avatarWrapper) {
        entranceLogo.style.animation = "none";
        entranceLogo.classList.remove("entrance-logo");
        entranceLogo.alt = "Bunny Profile";
        avatarWrapper.appendChild(entranceLogo);
    }
    overlay.classList.add("hidden");
    runEntranceSequence();
}

/**
 * Every frame, re-centers the backdrop's mask hole on the avatar's CURRENT
 * on-screen box (padded a bit) — whatever is moving it, CSS bounce or a WAAPI
 * flight animation, this doesn't care, it just reads the live position. That's
 * what makes the hole "chase" the avatar through both the bounce and the
 * later move-then-grow morph.
 */
function startHoleTracking(backdrop, avatarEl) {
    backdrop.style.transition = "none"; // snap every frame, no easing lag while tracking
    const tick = () => {
        const rect = avatarEl.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const enclosingRadius = Math.sqrt((rect.width / 2) ** 2 + (rect.height / 2) ** 2);

        backdrop.style.setProperty("--reveal-x", `${cx}px`);
        backdrop.style.setProperty("--reveal-y", `${cy}px`);
        backdrop.style.setProperty("--reveal-radius", `${enclosingRadius + HOLE_PADDING_PX}px`);

        holeTrackingRAF = requestAnimationFrame(tick);
    };
    tick();
}

function stopHoleTracking() {
    if (holeTrackingRAF) cancelAnimationFrame(holeTrackingRAF);
    holeTrackingRAF = null;
}

/**
 * Turns the loading-screen avatar into the real page avatar — literally the
 * same <img> element, not a lookalike copy that gets swapped in at the end.
 *
 * Technique: FLIP (First, Last, Invert, Play).
 *   First  — measure the element where it is now (small circle, in the overlay).
 *   Last   — actually move it into its final home (.avatar-wrapper) and measure
 *            where the browser now wants to render it (big rounded rect).
 *   Invert — since moving it snapped it straight to the "Last" box, immediately
 *            apply a transform that makes it LOOK like it's still at "First".
 *   Play   — animate that transform back to identity, so it visually grows/
 *            travels from First to Last — while being the one element the
 *            whole time. The hole-tracking loop above keeps following it the
 *            whole flight, so the reveal hole grows right along with it.
 */
function finishEntrance(overlay, backdrop, entranceLogo) {
    const avatarWrapper = document.querySelector(".avatar-wrapper");

    // Fallback for older browsers without Element.animate(), or if markup changed.
    if (!entranceLogo || !avatarWrapper || typeof entranceLogo.animate !== "function") {
        skipEntrance(overlay, entranceLogo);
        return;
    }

    // --- First -----------------------------------------------------------
    const firstRect = entranceLogo.getBoundingClientRect();

    // --- Last (do the real move) ------------------------------------------
    // Let the flight escape the wrapper's rounded-corner clipping while it's
    // still visually "outside" of it — restored once the animation lands.
    avatarWrapper.style.overflow = "visible";
    entranceLogo.style.animation = "none"; // hand off from the looping CSS bounce
    entranceLogo.classList.remove("entrance-logo");
    avatarWrapper.appendChild(entranceLogo); // now sized/positioned by ".avatar-wrapper img" rules

    const lastRect = entranceLogo.getBoundingClientRect();

    // --- Invert ------------------------------------------------------------
    const firstCenterX = firstRect.left + firstRect.width / 2;
    const firstCenterY = firstRect.top + firstRect.height / 2;
    const lastCenterX = lastRect.left + lastRect.width / 2;
    const lastCenterY = lastRect.top + lastRect.height / 2;

    const deltaX = firstCenterX - lastCenterX;
    const deltaY = firstCenterY - lastCenterY;
    const scaleX = firstRect.width / lastRect.width;
    const scaleY = firstRect.height / lastRect.height;

    // --- Play ----------------------------------------------------------
    // Two clearly separate phases instead of moving+growing at once:
    //   0 → 0.55   travel to the resting spot (with a little arc), still small & round
    //   0.55 → 1   now that it has arrived, grow into the full-size avatar
    const morph = entranceLogo.animate(
        [
            { transform: `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`, borderRadius: "50%", offset: 0, easing: "ease-out" },
            {
                transform: `translate(${deltaX * 0.45}px, ${deltaY * 0.45 - 50}px) scale(${scaleX}, ${scaleY})`,
                borderRadius: "50%",
                offset: 0.28,
                easing: "ease-in"
            },
            { transform: `translate(0px, 0px) scale(${scaleX}, ${scaleY})`, borderRadius: "50%", offset: 0.55, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
            // translateZ(20px) matches ".avatar-wrapper img" at rest, so there's no depth "pop" when the animation hands back to CSS.
            { transform: "translate(0px, 0px) scale(1, 1) translateZ(20px)", borderRadius: "16px", offset: 1 }
        ],
        { duration: MORPH_DURATION_MS, fill: "forwards" }
    );

    morph.onfinish = () => {
        avatarWrapper.style.overflow = ""; // back to the stylesheet's overflow: hidden
        entranceLogo.alt = "Bunny Profile"; // it's the real avatar now, not a loading spinner

        // Release the animation's hold on transform/border-radius so the
        // stylesheet (and its :hover rule) takes back over cleanly.
        morph.cancel();

        // The hole is now sized/positioned exactly on the landed avatar
        // (last tracked frame) — stop chasing it and hold it right there.
        stopHoleTracking();

        // Give it a beat to land before the page starts revealing.
        setTimeout(() => revealPage(overlay, backdrop), REVEAL_DELAY_MS);
    };
}

/**
 * Grows the already-avatar-sized hole out to cover the whole screen, so the
 * page finishes revealing starting from right where the avatar is.
 */
function revealPage(overlay, backdrop) {
    // Transition is back on (tracking turned it off) — animate from wherever
    // the last tracked frame left --reveal-radius out to a screen-covering size.
    backdrop.style.transition = "";
    backdrop.style.setProperty("--reveal-radius", "150vmax");

    // Fade the loading text out right away instead of leaving it sitting on
    // top of the now-visible page until the whole overlay disappears later.
    const loadingText = overlay.querySelector(".loading-text");
    if (loadingText) loadingText.style.opacity = "0";

    runEntranceSequence();

    setTimeout(() => overlay.classList.add("hidden"), REVEAL_DURATION_MS);
}

function runEntranceSequence() {
    const sequence = [
        document.querySelector(".title"),
        document.querySelector(".subtitle"),
        document.querySelector(".talks-text"),
        ...document.querySelectorAll(".link-btn"),
        document.querySelector(".donate-wrapper")
    ];

    sequence.forEach((el, index) => {
        if (!el) return;
        setTimeout(() => {
            el.classList.add("fade-in");
        }, index * 100);
    });
}

// 1. Hàm bật tắt QR Code
document.addEventListener("DOMContentLoaded", () => {
    const btnDonate = document.getElementById("btn-donate");
    const qrSection = document.getElementById("qrSection");

    if (btnDonate && qrSection) {
        btnDonate.addEventListener("click", () => {
            qrSection.classList.toggle("active");
        });
    }
});

// 4. Theme Halloween: đổi chữ + thả vài con ma, con dơi trôi trên nền
if (isHalloween) {
    applyHalloweenText();
    if (!prefersReducedMotion) spawnHalloweenCritters();
}

function applyHalloweenText() {
    const kaomoji = document.querySelector(".kaomoji");
    if (kaomoji) kaomoji.textContent = "👻 ε ⋒ x ⋒ 3 🎃";

    const donateBtn = document.getElementById("btn-donate");
    if (donateBtn) donateBtn.innerHTML = '<i class="fa-solid fa-carrot"></i> Trick or carrot? 🎃🐰';
}

function spawnHalloweenCritters() {
    // [top, left, quãng trôi ngang, thời gian, độ trễ]
    const ghosts = [
        ["68vh", "4vw", "38vw", "24s", "1s"],
        ["30vh", "70vw", "-30vw", "28s", "9s"],
        ["85vh", "45vw", "-36vw", "26s", "16s"]
    ];
    ghosts.forEach(([top, left, dx, duration, delay]) => {
        const ghost = document.createElement("div");
        ghost.className = "halloween-ghost";
        ghost.style.top = top;
        ghost.style.left = left;
        ghost.style.setProperty("--ghost-dx", dx);
        ghost.style.setProperty("--ghost-duration", duration);
        ghost.style.setProperty("--ghost-delay", delay);
        document.body.appendChild(ghost);
    });

    // [top, thời gian bay ngang, độ trễ]
    const bats = [["12vh", "14s", "3s"], ["22vh", "19s", "10s"]];
    bats.forEach(([top, duration, delay]) => {
        const bat = document.createElement("div");
        bat.className = "halloween-bat";
        bat.style.top = top;
        bat.style.setProperty("--bat-duration", duration);
        bat.style.setProperty("--bat-delay", delay);
        document.body.appendChild(bat);
    });
}

// Thư viện CDN được tải bằng "defer" (sau file này), nên phải đợi DOMContentLoaded
// mới chắc chắn chúng đã chạy xong. Người dùng bật giảm chuyển động thì bỏ qua cả hai.
document.addEventListener("DOMContentLoaded", () => {
    if (prefersReducedMotion) return;
    initTilt();
    initParticles();
});

// 2. Khởi tạo hiệu ứng nghiêng 3D
function initTilt() {
    if (typeof VanillaTilt !== "undefined") {
        VanillaTilt.init(document.querySelectorAll(".link-btn, .avatar-wrapper"), {
            max: 12,
            speed: 400,
            glare: true,
            "max-glare": 0.25,
            perspective: 1000
        });
    }
}

// 3. Khởi tạo hệ thống hạt nền (Particles)
function initParticles() {
    if (typeof particlesJS !== "undefined") {
        particlesJS("particles-js", {
            "particles": {
                "number": { "value": 50, "density": { "enable": true, "value_area": 800 } },
                // Halloween: đốm ma trơi cam/xanh/tím, sáng hơn một chút
                "color": { "value": isHalloween ? ["#ff7518", "#7cff4f", "#b48cff"] : "#ffffff" },
                "shape": { "type": "circle" },
                "opacity": {
                    "value": isHalloween ? 0.45 : 0.2,
                    "random": true, 
                    "anim": { "enable": true, "speed": 1, "opacity_min": 0.05, "sync": false }
                },
                "size": { 
                    "value": isHalloween ? 3 : 2,
                    "random": true
                },
                "line_linked": {
                    "enable": true,
                    "distance": 150,
                    "color": isHalloween ? "#9b4dff" : "#ffffff", // mạng nhện tím
                    "opacity": isHalloween ? 0.15 : 0.1,
                    "width": 1
                },
                "move": {
                    "enable": true,
                    "speed": 1,
                    "direction": isHalloween ? "top" : "none", // ma trơi bay lên
                    "random": true, 
                    "out_mode": "out" 
                }
            },
            "interactivity": {
                "detect_on": "window",
                "events": {
                    "onhover": { "enable": true, "mode": "grab" },
                    "resize": true
                },
                "modes": {
                    "grab": { "distance": 150, "line_linked": { "opacity": 0.3 } }
                }
            },
            "retina_detect": true
        });
    }
}
