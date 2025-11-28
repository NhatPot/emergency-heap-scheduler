# Hệ thống xếp lịch bệnh nhân cấp cứu (Heap Scheduler)

## Tác giả

- Lê Minh Nhật
- Nguyễn Tuấn Nguyễn
- Nguyễn Đức Tín

Ứng dụng mô phỏng phòng cấp cứu dựa trên **Max-Heap Priority Queue**. Mỗi node.patient chứa:

| Thuộc tính | Ý nghĩa |
|------------|---------|
| `code`     | Mã bệnh nhân duy nhất |
| `name`     | Họ tên |
| `admittedAt` | Thời điểm nhập viện (ISO datetime) |
| `severity` | Mức độ nguy kịch 1–10 (10 nguy kịch nhất) |

Nếu severity bằng nhau, bệnh nhân nhập viện sớm hơn (timestamp nhỏ hơn) sẽ có ưu tiên cao hơn.

## Chức năng nổi bật

- Form thêm bệnh nhân với validation, mapping mức độ rõ ràng.
- Bảng hàng đợi ưu tiên (lọc theo tên/mức độ, xem chi tiết, xoá từng bệnh nhân).
- Nút xử lý bệnh nhân khẩn cấp nhất (extract-max).
- Minh hoạ Heap dạng mảng và dạng cây, kèm timeline từng bước sift-up / sift-down.
- Log sự kiện, nút xoá log, nút reset hệ thống, nút sinh N bệnh nhân demo.
- Thống kê tổng quát từng bucket mức độ.

## Yêu cầu môi trường

- Python ≥ 3.10
- Các gói trong `requirements.txt` (hiện gồm Flask 3.0.2)

## Các bước chạy ứng dụng

```bash
# 1. Tạo và kích hoạt môi trường ảo (khuyến nghị)
python -m venv .venv
.venv\Scripts\activate    # Windows
# source .venv/bin/activate  # macOS/Linux

# 2. Cài đặt phụ thuộc
pip install -r requirements.txt

# 3. Chạy ứng dụng
python app.py
```

Sau khi chạy, mở trình duyệt đến `http://127.0.0.1:5000` để tương tác.

## Cấu trúc thư mục

```
app.py                # Flask app + REST endpoints
services/heap.py      # Lớp EmergencyHeap + Patient model
templates/index.html  # Giao diện chính (HTML)
static/styles.css     # Dark UI + responsive layout
static/app.js         # Logic front-end, minh hoạ thuật toán
requirements.txt      # Phụ thuộc (Flask)
```


