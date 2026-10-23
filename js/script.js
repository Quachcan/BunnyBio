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
// Theme theo mùa: bật/tắt bởi script trong <head> (theo ngày, hoặc ?theme=...)
const isHalloween = document.documentElement.classList.contains("halloween");
const isChristmas = document.documentElement.classList.contains("christmas");
const isTet = document.documentElement.classList.contains("tet");

// Nội dung tuỳ chỉnh từ js/config.js (ảnh avatar, gallery, nhạc). Thiếu file thì coi như trống.
const CONFIG = typeof BIO_CONFIG !== "undefined" ? BIO_CONFIG : {};

// Dựng gallery ngay từ đầu để nó có mặt trong chuỗi hiện dần (runEntranceSequence),
// kể cả khi màn loading bị bỏ qua ngay lập tức (giảm chuyển động).
buildGallery();

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
    // Đợi phần còn lại của file chạy xong (chèn lời chúc Tết, v.v.) rồi mới cho hiện dần,
    // vì đường giảm chuyển động gọi tới đây ngay khi file vừa bắt đầu chạy.
    setTimeout(runEntranceSequence, 0);
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
    // Same for the "tap to enter" music hint, if it was shown.
    overlay.querySelectorAll(".loading-text, .entrance-hint").forEach((el) => { el.style.opacity = "0"; });

    runEntranceSequence();

    setTimeout(() => overlay.classList.add("hidden"), REVEAL_DURATION_MS);
}

function runEntranceSequence() {
    const sequence = [
        document.querySelector(".title"),
        document.querySelector(".subtitle"),
        document.querySelector(".tet-greeting"), // chỉ có khi bật theme Tết
        document.querySelector(".tagline"),
        document.querySelector(".gallery"),
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

    // Avatar đã nằm đúng chỗ trong .avatar-wrapper → giờ mới bật đổi ảnh luân phiên
    initAvatarRotation();
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

// 5. Theme Giáng sinh: đổi chữ + sao lấp lánh và nền tuyết dưới chân thỏ
if (isChristmas) {
    applyChristmasText();
    spawnChristmasScenery();
}

function applyChristmasText() {
    const kaomoji = document.querySelector(".kaomoji");
    if (kaomoji) kaomoji.textContent = "🎄 ε ⋒ x ⋒ 3 ❄️";

    const donateBtn = document.getElementById("btn-donate");
    if (donateBtn) donateBtn.innerHTML = '<i class="fa-solid fa-gift"></i> Gift me a carrot 🎁🐰';
}

function spawnChristmasScenery() {
    // Nền tuyết đứng yên nên vẫn hiện cả khi giảm chuyển động (CSS tự tắt nhấp nháy của sao)
    const ground = document.createElement("div");
    ground.className = "christmas-snowground";
    document.body.appendChild(ground);

    // [top, left, thời gian nhấp nháy, độ trễ]
    const stars = [
        ["6vh", "8vw", "2.2s", "0s"],
        ["14vh", "88vw", "2.8s", "0.7s"],
        ["4vh", "62vw", "2.5s", "1.3s"],
        ["24vh", "20vw", "3s", "0.4s"],
        ["30vh", "78vw", "2.4s", "1.8s"]
    ];
    stars.forEach(([top, left, duration, delay]) => {
        const star = document.createElement("div");
        star.className = "christmas-star";
        star.style.top = top;
        star.style.left = left;
        star.style.setProperty("--star-duration", duration);
        star.style.setProperty("--star-delay", delay);
        document.body.appendChild(star);
    });
}

// 6. Theme Tết: lời chúc + đèn lồng treo và pháo hoa trên nền
if (isTet) {
    applyTetText();
    spawnTetScenery();
}

function applyTetText() {
    const subtitle = document.querySelector(".subtitle");
    if (subtitle) {
        const greeting = document.createElement("div");
        greeting.className = "tet-greeting";
        greeting.textContent = "Chúc Mừng Năm Mới";
        subtitle.after(greeting);
    }

    const kaomoji = document.querySelector(".kaomoji");
    if (kaomoji) kaomoji.textContent = "🧧 ε ⋒ x ⋒ 3 🌸";

    const donateBtn = document.getElementById("btn-donate");
    if (donateBtn) donateBtn.innerHTML = '<i class="fa-solid fa-envelope"></i> Lì xì cho thỏ 🧧🐰';
}

function spawnTetScenery() {
    // Đèn lồng đứng yên được khi giảm chuyển động (CSS tự tắt đung đưa)
    // [left, thời gian đung đưa, độ trễ]
    const lanterns = [["3vw", "3.4s", "0s"], ["11vw", "3.9s", "0.6s"], ["calc(97vw - 40px)", "3.6s", "0.3s"], ["calc(89vw - 40px)", "4.1s", "0.9s"]];
    lanterns.forEach(([left, duration, delay]) => {
        const lantern = document.createElement("div");
        lantern.className = "tet-lantern";
        lantern.style.left = left;
        lantern.style.setProperty("--lantern-duration", duration);
        lantern.style.setProperty("--lantern-delay", delay);
        document.body.appendChild(lantern);
    });

    if (prefersReducedMotion) return;

    // [top, left, màu, thời gian, độ trễ]
    const fireworks = [
        ["16vh", "14vw", "#ffcc4d", "3.2s", "0.5s"],
        ["10vh", "82vw", "#ff8fb1", "3.6s", "1.6s"],
        ["38vh", "88vw", "#ffd23f", "3.4s", "2.4s"],
        ["44vh", "8vw", "#ff6b6b", "3.8s", "1.1s"]
    ];
    fireworks.forEach(([top, left, color, duration, delay]) => {
        const fw = document.createElement("div");
        fw.className = "tet-firework";
        fw.style.top = top;
        fw.style.left = left;
        fw.style.color = color;
        fw.style.setProperty("--fw-duration", duration);
        fw.style.setProperty("--fw-delay", delay);
        document.body.appendChild(fw);
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
    if (typeof particlesJS === "undefined") return;

    const config = {
        "particles": {
            "number": { "value": 50, "density": { "enable": true, "value_area": 800 } },
            "color": { "value": "#ffffff" },
            "shape": { "type": "circle" },
            "opacity": {
                "value": 0.2,
                "random": true,
                "anim": { "enable": true, "speed": 1, "opacity_min": 0.05, "sync": false }
            },
            "size": {
                "value": 2,
                "random": true
            },
            "line_linked": {
                "enable": true,
                "distance": 150,
                "color": "#ffffff",
                "opacity": 0.1,
                "width": 1
            },
            "move": {
                "enable": true,
                "speed": 1,
                "direction": "none",
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
                "grab": { "distance": 150, "line_linked": { "opacity": 0.3 } },
                "repulse": { "distance": 90, "duration": 0.4 }
            }
        },
        "retina_detect": true
    };
    const p = config.particles;

    if (isHalloween) {
        // Đốm ma trơi cam/xanh/tím bay lên, nối nhau bằng mạng nhện tím
        p.color.value = ["#ff7518", "#7cff4f", "#b48cff"];
        p.opacity.value = 0.45;
        p.size.value = 3;
        p.line_linked.color = "#9b4dff";
        p.line_linked.opacity = 0.15;
        p.move.direction = "top";
    }

    if (isChristmas) {
        // Tuyết rơi: nhiều hạt hơn, to hơn, không nối dây; rê chuột thì tuyết dạt ra
        p.number.value = 90;
        p.opacity.value = 0.75;
        p.opacity.anim.enable = false;
        p.size.value = 3.5;
        p.line_linked.enable = false;
        p.move.direction = "bottom";
        p.move.speed = 1.3;
        config.interactivity.events.onhover.mode = "repulse";
    }

    if (isTet) {
        // Cánh hoa mai vàng + hoa đào hồng rơi chéo theo gió
        p.number.value = 45;
        p.color.value = ["#ffd23f", "#ffe680", "#ff8fb1", "#ffb7c5"];
        p.opacity.value = 0.85;
        p.opacity.anim.enable = false;
        p.size.value = 4.5;
        p.line_linked.enable = false;
        p.move.direction = "bottom-right";
        p.move.speed = 1.4;
        config.interactivity.events.onhover.mode = "repulse";
    }

    particlesJS("particles-js", config);
}

// 7. Gallery ảnh nổi bật — dựng từ CONFIG.galleryPhotos, bấm ảnh để xem lớn
function buildGallery() {
    const photos = CONFIG.galleryPhotos || [];
    const anchor = document.querySelector(".talks-text");
    if (!photos.length || !anchor) return;

    const gallery = document.createElement("section");
    gallery.className = "gallery";
    gallery.setAttribute("aria-label", "Ảnh nổi bật");

    const track = document.createElement("div");
    track.className = "gallery-track";

    photos.forEach((src, index) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "gallery-item";
        item.setAttribute("aria-label", `Xem ảnh ${index + 1}`);

        const img = document.createElement("img");
        img.src = src;
        img.alt = "";
        img.loading = "lazy";
        img.decoding = "async";
        img.draggable = false;

        item.appendChild(img);
        item.addEventListener("click", () => openLightbox(photos, index));
        track.appendChild(item);
    });

    const prev = createIconButton("gallery-nav gallery-prev", "fa-chevron-left", "Ảnh trước");
    const next = createIconButton("gallery-nav gallery-next", "fa-chevron-right", "Ảnh sau");
    const step = () => track.clientWidth * 0.8;
    prev.addEventListener("click", () => track.scrollBy({ left: -step() }));
    next.addEventListener("click", () => track.scrollBy({ left: step() }));

    // Ẩn nút trái/phải khi đã cuộn tới đầu/cuối dải ảnh
    const updateNav = () => {
        prev.disabled = track.scrollLeft <= 2;
        next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    };
    track.addEventListener("scroll", updateNav, { passive: true });
    window.addEventListener("resize", updateNav);
    requestAnimationFrame(updateNav);

    gallery.append(track, prev, next);
    anchor.before(gallery);

    // Ảnh hiện dần (mờ → rõ) khi cuộn tới
    const items = track.querySelectorAll(".gallery-item");
    if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            });
        }, { root: track, rootMargin: "0px 60px", threshold: 0.2 });
        items.forEach((item) => observer.observe(item));
    } else {
        items.forEach((item) => item.classList.add("is-visible"));
    }

    // Cản bớt việc chuột phải → "Lưu ảnh" (chỉ là rào nhẹ, watermark mới là cách chắc chắn)
    gallery.addEventListener("contextmenu", (e) => e.preventDefault());
}

function createIconButton(className, icon, label) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.setAttribute("aria-label", label);
    button.innerHTML = `<i class="fa-solid ${icon}"></i>`;
    return button;
}

let lightbox = null;

function openLightbox(photos, startIndex) {
    if (!lightbox) lightbox = createLightbox();
    lightbox.photos = photos;
    lightbox.show(startIndex);
    lightbox.el.classList.add("open");
    lightbox.lastFocus = document.activeElement;
    document.body.style.overflow = "hidden";
    lightbox.closeBtn.focus();
}

function createLightbox() {
    const el = document.createElement("div");
    el.className = "lightbox";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "Xem ảnh");

    const img = document.createElement("img");
    img.className = "lightbox-img";
    img.alt = "";
    img.draggable = false;

    const closeBtn = createIconButton("lightbox-btn lightbox-close", "fa-xmark", "Đóng");
    const prevBtn = createIconButton("lightbox-btn lightbox-prev", "fa-chevron-left", "Ảnh trước");
    const nextBtn = createIconButton("lightbox-btn lightbox-next", "fa-chevron-right", "Ảnh sau");
    const counter = document.createElement("div");
    counter.className = "lightbox-counter";

    el.append(img, closeBtn, prevBtn, nextBtn, counter);
    document.body.appendChild(el);

    const box = { el, closeBtn, photos: [], index: 0, lastFocus: null };

    box.show = (index) => {
        const total = box.photos.length;
        box.index = (index + total) % total;
        img.classList.add("switching");
        // Đổi ảnh khi ảnh cũ đã mờ đi, tránh giật
        setTimeout(() => {
            img.onload = () => img.classList.remove("switching");
            img.src = box.photos[box.index];
            if (img.complete) img.classList.remove("switching");
        }, el.classList.contains("open") ? 150 : 0);
        counter.textContent = `${box.index + 1} / ${total}`;
        const single = total < 2;
        prevBtn.hidden = single;
        nextBtn.hidden = single;
    };

    const close = () => {
        el.classList.remove("open");
        document.body.style.overflow = "";
        if (box.lastFocus) box.lastFocus.focus();
    };

    closeBtn.addEventListener("click", close);
    prevBtn.addEventListener("click", () => box.show(box.index - 1));
    nextBtn.addEventListener("click", () => box.show(box.index + 1));
    // Bấm ra vùng tối bên ngoài ảnh cũng đóng
    el.addEventListener("click", (e) => { if (e.target === el) close(); });
    el.addEventListener("contextmenu", (e) => e.preventDefault());

    document.addEventListener("keydown", (e) => {
        if (!el.classList.contains("open")) return;
        if (e.key === "Escape") close();
        if (e.key === "ArrowLeft") box.show(box.index - 1);
        if (e.key === "ArrowRight") box.show(box.index + 1);
    });

    // Vuốt trái/phải trên điện thoại để chuyển ảnh
    let touchX = null;
    el.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    el.addEventListener("touchend", (e) => {
        if (touchX === null) return;
        const dx = e.changedTouches[0].clientX - touchX;
        if (Math.abs(dx) > 50) box.show(box.index + (dx < 0 ? 1 : -1));
        touchX = null;
    });

    return box;
}

// 8. Avatar đổi ảnh luân phiên — bấm để đổi, tự đổi mỗi 6 giây (dừng khi rê chuột)
const AVATAR_ROTATE_MS = 6000;
let avatarRotationStarted = false;

function initAvatarRotation() {
    const photos = ["images/Avatar.jpg", ...(CONFIG.avatarPhotos || [])];
    const wrapper = document.querySelector(".avatar-wrapper");
    const img = wrapper && wrapper.querySelector("img");
    if (avatarRotationStarted || photos.length < 2 || !img) return;
    avatarRotationStarted = true;

    photos.slice(1).forEach((src) => { new Image().src = src; }); // tải trước cho mượt

    const dotsBox = document.querySelector(".avatar-dots");
    const dots = photos.map((_, i) => {
        const dot = document.createElement("span");
        dot.style.animationDelay = `${i * 60}ms`;
        if (dotsBox) dotsBox.appendChild(dot);
        return dot;
    });

    let index = 0;
    let busy = false;
    let hovering = false;

    const show = (next) => {
        if (busy) return;
        busy = true;
        index = (next + photos.length) % photos.length;
        dots.forEach((dot, i) => dot.classList.toggle("active", i === index));

        // Ảnh mới mờ dần lên trên ảnh cũ, xong thì gán vào ảnh gốc và bỏ lớp phủ
        const layer = document.createElement("img");
        layer.className = "avatar-layer";
        layer.src = photos[index];
        layer.alt = "";
        wrapper.appendChild(layer);
        requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add("visible")));
        setTimeout(() => {
            img.src = photos[index];
            layer.remove();
            busy = false;
        }, 650);
    };

    dots[0].classList.add("active");
    wrapper.classList.add("has-photos");
    wrapper.setAttribute("role", "button");
    wrapper.setAttribute("tabindex", "0");
    wrapper.setAttribute("aria-label", "Đổi ảnh đại diện");

    wrapper.addEventListener("click", () => show(index + 1));
    wrapper.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        show(index + 1);
    });
    wrapper.addEventListener("mouseenter", () => { hovering = true; });
    wrapper.addEventListener("mouseleave", () => { hovering = false; });

    if (!prefersReducedMotion) {
        setInterval(() => {
            if (!hovering && !document.hidden) show(index + 1);
        }, AVATAR_ROTATE_MS);
    }
}

// 9. Spotlight: vầng sáng mờ chạy theo con trỏ trên nền (chỉ máy có chuột)
(() => {
    if (prefersReducedMotion || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const spotlight = document.createElement("div");
    spotlight.className = "spotlight";
    document.body.appendChild(spotlight);

    let frame = null;
    document.addEventListener("mousemove", (e) => {
        if (frame) return;
        frame = requestAnimationFrame(() => {
            spotlight.style.setProperty("--mx", `${e.clientX}px`);
            spotlight.style.setProperty("--my", `${e.clientY}px`);
            spotlight.classList.add("on");
            frame = null;
        });
    });
    document.documentElement.addEventListener("mouseleave", () => spotlight.classList.remove("on"));
})();

// 10. Mini player nhạc nền — tự phát khi được phép, không thì phát ở lần chạm đầu tiên.
// Đang phát thì mở rộng thành thanh có tên bài + timeline để tua; tạm dừng thì vài giây sau thu gọn lại.
const MUSIC_COLLAPSE_MS = 4000;
const MUSIC_VOLUME = 0.4;
const MUSIC_FADE_MS = 2000;

(() => {
    // CONFIG.music là danh sách bài [{ src, title }] (vẫn nhận kiểu cũ: một đường dẫn duy nhất)
    const tracks = Array.isArray(CONFIG.music)
        ? CONFIG.music.filter((t) => t && t.src)
        : CONFIG.music ? [{ src: CONFIG.music, title: CONFIG.musicTitle }] : [];
    if (!tracks.length) return;

    const audio = new Audio(tracks[0].src);
    // 1 bài thì lặp lại bài đó; nhiều bài thì hết bài tự chuyển sang bài kế (xoay vòng)
    audio.loop = tracks.length === 1;
    audio.volume = MUSIC_VOLUME;
    audio.preload = "none";

    const player = document.createElement("div");
    player.className = "music-player";
    player.setAttribute("role", "region");
    player.setAttribute("aria-label", "Trình phát nhạc");
    player.innerHTML = `
        <div class="music-panel">
            <div class="music-meta">
                <span class="music-eq" aria-hidden="true"><i></i><i></i><i></i></span>
                <span class="music-title"></span>
                <span class="music-skip">
                    <button type="button" class="music-prev" aria-label="Bài trước"><i class="fa-solid fa-backward-step"></i></button>
                    <button type="button" class="music-next" aria-label="Bài sau"><i class="fa-solid fa-forward-step"></i></button>
                </span>
            </div>
            <input type="range" class="music-seek" min="0" max="0" step="0.1" value="0" aria-label="Tua nhạc" disabled>
            <div class="music-times"><span class="music-current">0:00</span><span class="music-duration">--:--</span></div>
        </div>`;
    const toggle = createIconButton("music-toggle", "fa-music", "Bật nhạc nền");
    toggle.setAttribute("aria-pressed", "false");
    player.appendChild(toggle);
    document.body.appendChild(player);
    document.body.classList.add("has-music-player");

    const icon = toggle.querySelector("i");
    const seek = player.querySelector(".music-seek");
    const current = player.querySelector(".music-current");
    const duration = player.querySelector(".music-duration");
    const title = player.querySelector(".music-title");
    player.querySelector(".music-skip").hidden = tracks.length < 2;

    const formatTime = (seconds) => {
        if (!isFinite(seconds)) return "--:--";
        const s = Math.floor(seconds);
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    };

    const showProgress = (time) => {
        const total = audio.duration || 0;
        seek.value = time;
        seek.style.setProperty("--progress", total ? `${(time / total) * 100}%` : "0%");
        current.textContent = formatTime(time);
    };

    // --- Mở rộng / thu gọn ------------------------------------------------
    let started = false;
    let hovering = false;
    let collapseTimer = null;

    const expand = () => {
        clearTimeout(collapseTimer);
        player.classList.add("expanded");
    };
    const collapseLater = (delay) => {
        clearTimeout(collapseTimer);
        collapseTimer = setTimeout(() => {
            // Chỉ giữ mở khi đang thao tác bằng bàn phím (:focus-visible), bấm chuột thì vẫn thu gọn
            if (audio.paused && !hovering && !player.querySelector(":focus-visible")) {
                player.classList.remove("expanded");
            }
        }, delay);
    };

    player.addEventListener("mouseenter", () => {
        hovering = true;
        if (started) expand();
    });
    player.addEventListener("mouseleave", () => {
        hovering = false;
        if (audio.paused) collapseLater(1500);
    });

    // --- Phát / tạm dừng --------------------------------------------------
    const setPlaying = (playing) => {
        player.classList.toggle("playing", playing);
        icon.className = `fa-solid ${playing ? "fa-pause" : started ? "fa-play" : "fa-music"}`;
        toggle.setAttribute("aria-pressed", String(playing));
        toggle.setAttribute("aria-label", playing ? "Tạm dừng nhạc nền" : "Phát nhạc nền");
        if (playing) expand();
        else collapseLater(MUSIC_COLLAPSE_MS);
    };

    // Nhạc to dần từ 0 lên MUSIC_VOLUME thay vì phát ầm lên ngay
    let fadeFrame = null;
    const fadeIn = () => {
        cancelAnimationFrame(fadeFrame);
        const startAt = performance.now();
        audio.volume = 0;
        const step = (now) => {
            const t = Math.min((now - startAt) / MUSIC_FADE_MS, 1);
            audio.volume = MUSIC_VOLUME * t;
            if (t < 1) fadeFrame = requestAnimationFrame(step);
        };
        fadeFrame = requestAnimationFrame(step);
    };

    // Trả về true nếu phát được (trình duyệt có thể chặn khi khách chưa chạm/bấm gì)
    const play = () => audio.play().then(() => {
        started = true;
        fadeIn();
        return true;
    }).catch(() => false);

    // Khách đã tự bấm tạm dừng thì không bao giờ tự bật lại nữa
    let userPaused = false;

    toggle.addEventListener("click", () => {
        if (audio.paused) {
            userPaused = false;
            play();
        } else {
            userPaused = true;
            audio.pause();
        }
    });
    audio.addEventListener("play", () => setPlaying(true));
    audio.addEventListener("pause", () => setPlaying(false));

    // --- Tự phát -------------------------------------------------------------
    // 1) Thử phát ngay khi trang load (Chrome đôi khi cho phép với khách quen).
    // 2) Bị chặn thì phát ở lần chạm/bấm/nhấn phím đầu tiên ở bất kỳ đâu trên trang
    //    — kể cả chạm vào màn loading để bỏ qua, nhạc vào đúng lúc avatar bay lên.
    const unlockEvents = ["pointerdown", "touchend", "click", "keydown"];
    const stopListening = () => unlockEvents.forEach((type) => document.removeEventListener(type, onFirstInteraction, true));
    const onFirstInteraction = (e) => {
        // Bấm thẳng vào nút ♪ thì để nút tự xử lý, tránh vừa bật đã tắt
        if (player.contains(e.target)) { stopListening(); return; }
        if (userPaused || !audio.paused) { stopListening(); return; }
        play().then((ok) => { if (ok) stopListening(); });
    };
    unlockEvents.forEach((type) => document.addEventListener(type, onFirstInteraction, true));

    play().then((ok) => {
        if (ok) {
            stopListening();
            return;
        }
        // Gợi ý khách chạm vào màn loading (nếu màn loading vẫn còn đang hiện)
        const overlay = document.getElementById("entrance-overlay");
        if (overlay && !overlay.classList.contains("hidden")) {
            const hint = document.createElement("div");
            hint.className = "entrance-hint";
            hint.textContent = "chạm để vào 🎧";
            overlay.appendChild(hint);
        }
    });

    // --- Timeline ----------------------------------------------------------
    let dragging = false;

    audio.addEventListener("loadedmetadata", () => {
        seek.max = audio.duration;
        seek.disabled = false;
        duration.textContent = formatTime(audio.duration);
    });
    audio.addEventListener("timeupdate", () => {
        if (!dragging) showProgress(audio.currentTime);
    });

    // Kéo thanh tua: cập nhật số giây ngay, thả tay mới nhảy nhạc tới đó
    seek.addEventListener("input", () => {
        dragging = true;
        showProgress(Number(seek.value));
    });
    seek.addEventListener("change", () => {
        audio.currentTime = Number(seek.value);
        dragging = false;
    });

    // --- Playlist ------------------------------------------------------------
    let trackIndex = 0;

    const showTrack = () => {
        const name = tracks[trackIndex].title || "Nhạc nền";
        title.textContent = CONFIG.musicArtist ? `${name} · ${CONFIG.musicArtist}` : name;
        title.title = title.textContent; // tên dài bị cắt "..." thì rê chuột vẫn xem đủ
    };

    const switchTrack = (index) => {
        const wasPlaying = !audio.paused;
        trackIndex = (index + tracks.length) % tracks.length;
        audio.src = tracks[trackIndex].src;
        seek.disabled = true;
        duration.textContent = "--:--";
        showProgress(0);
        showTrack();
        if (wasPlaying) play();
    };

    showTrack();

    player.querySelector(".music-prev").addEventListener("click", () => {
        // Giống app nghe nhạc: đã nghe quá 3 giây thì "bài trước" quay về đầu bài đang nghe
        if (audio.currentTime > 3) {
            audio.currentTime = 0;
            return;
        }
        switchTrack(trackIndex - 1);
    });
    player.querySelector(".music-next").addEventListener("click", () => switchTrack(trackIndex + 1));

    // Hết bài thì tự sang bài kế (chỉ xảy ra khi có từ 2 bài, vì 1 bài thì audio.loop)
    audio.addEventListener("ended", () => {
        switchTrack(trackIndex + 1);
        play();
    });
})();
