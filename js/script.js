// js/script.js

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

// 2. Khởi tạo hiệu ứng nghiêng 3D
// Đảm bảo thư viện VanillaTilt đã load trước khi file này chạy
if (typeof VanillaTilt !== "undefined") {
    VanillaTilt.init(document.querySelectorAll(".link-btn, .avatar-wrapper"), {
        max: 12,
        speed: 400,
        glare: true,
        "max-glare": 0.25,
        perspective: 1000
    });
}

// 3. Khởi tạo hệ thống hạt nền (Particles)
if (typeof particlesJS !== "undefined") {
    particlesJS("particles-js", {
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
                "grab": { "distance": 150, "line_linked": { "opacity": 0.3 } }
            }
        },
        "retina_detect": true
    });
}