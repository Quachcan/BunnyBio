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

    // Playlist nhạc nền — phát theo thứ tự, hết bài tự sang bài kế, hết danh sách quay lại bài đầu.
    // Tự phát nếu trình duyệt cho phép, không thì phát ở lần chạm đầu tiên. Để [] thì ẩn trình phát.
    // Thêm bài: bỏ file vào thư mục audio/ rồi thêm 1 dòng { src: "...", title: "..." }
    music: [
        { src: "audio/606.m4a", title: "6.0.6" },
        { src: "audio/nguyet.m4a", title: "Nguyệt" }
    ],

    // Tên ca sĩ hiện sau tên bài, ví dụ "Nguyệt · Bunny". Để "" thì chỉ hiện tên bài.
    musicArtist: "",

    // Các cách donate — mỗi mục là 1 tab trong thẻ "Buy me a carrot".
    //   name          : tên hiện trên tab
    //   qr            : ảnh mã QR
    //   accountName   : tên chủ tài khoản (để "" thì ẩn)
    //   accountNumber : số tài khoản — có thì hiện nút "Sao chép STK" (để "" thì ẩn)
    //   link          : link mở thẳng (vd paypal.me/...) — có thì hiện nút "Mở link" (để "" thì ẩn)
    //   color         : màu nhấn của tab (màu thương hiệu)
    donate: [
        {
            name: "MB Bank",
            qr: "images/qr-code.jpg",
            accountName: "LE THI THANH HUONG",
            accountNumber: "0935428662",
            link: "",
            color: "#2a5bd7"
        },
        {
            name: "MoMo",
            qr: "images/qr-code-2.jpg",
            accountName: "",
            accountNumber: "", // TODO: điền số MoMo khi có
            link: "",
            color: "#c2177a"
        },
        {
            name: "PayPal",
            qr: "images/qr-code-3.jpg",
            accountName: "",
            accountNumber: "",
            link: "",
            color: "#0070e0"
        }
    ]
};
