// js/config.js
// Những thứ hay thay đổi của bio — sửa ở đây là đủ, không cần đụng script.js.
// Mẹo: ảnh nên được nén (WebP ~100–200KB/ảnh) và xoá EXIF (vị trí GPS) trước khi đưa lên.

const BIO_CONFIG = {
    // Ảnh luân phiên cho avatar, ngoài images/Avatar.jpg.
    // Bấm vào avatar để đổi ảnh, và tự đổi mỗi 6 giây. Để [] thì avatar đứng yên.
    // Ví dụ: ["images/avatar-2.jpg", "images/avatar-3.jpg"]
    avatarPhotos: [],

    // Ảnh cho gallery (nên là ảnh dọc tỉ lệ 3:4). Để [] thì ẩn gallery.
    // Ví dụ: ["images/gallery/01.webp", "images/gallery/02.webp"]
    // Đang tạm ẩn gallery. Muốn hiện lại: bỏ dấu // ở 4 dòng ảnh bên dưới.
    galleryPhotos: [
        // "images/gallery/01.webp",
        // "images/gallery/02.webp",
        // "images/gallery/03.webp",
        // "images/gallery/04.webp"
    ],

    // Nhạc nền — mặc định tắt, khách bấm nút ♪ ở góc trên mới phát. Để "" thì ẩn nút.
    // Ví dụ: "audio/bgm.mp3"
    music: "audio/bgm.m4a",

    // Tên bài hiện trên trình phát nhạc. Để "" thì hiện "Nhạc nền".
    musicTitle: "Bunny's playlist"
};
