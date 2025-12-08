import os
from typing import Any, Dict

from flask import Flask, jsonify, render_template, request

from services.heap import EmergencyHeap


app = Flask(__name__, static_folder="static", template_folder="templates")
scheduler = EmergencyHeap()


def build_state() -> Dict[str, Any]:
    """Chuẩn hóa dữ liệu trả về cho front-end."""
    return {
        "queue": scheduler.to_priority_list(),
        "heapArray": scheduler.to_heap_array(),
        "stats": scheduler.stats(),
        "logs": scheduler.logs(),
        "steps": scheduler.last_steps(),
        "severityMapping": scheduler.severity_mapping(),
    }


@app.route("/")
def index() -> str:
    return render_template("index.html")


@app.route("/api/dashboard", methods=["GET"])
def dashboard():
    return jsonify(build_state())


@app.route("/api/patients", methods=["POST"])
def add_patient():
    payload = request.get_json(force=True)
    try:
        record = scheduler.add_patient(
            code=payload.get("code", ""),
            name=payload.get("name", ""),
            admitted_at=payload.get("admittedAt", ""),
            severity=int(payload.get("severity", 0)),
        )
    except (ValueError, TypeError) as exc:
        return jsonify({"error": str(exc)}), 400
    return jsonify(
        {
            "message": f"Đã thêm bệnh nhân {record['code']}.",
            "patient": record,
            "state": build_state(),
        }
    )


@app.route("/api/patients/process", methods=["POST"])
def process_patient():
    record = scheduler.extract_next()
    if record is None:
        return jsonify({"message": "Không còn bệnh nhân trong hàng đợi.", "state": build_state()}), 200
    return jsonify(
        {
            "message": f"Đã xử lý bệnh nhân {record['code']}.",
            "processed": record,
            "state": build_state(),
        }
    )


@app.route("/api/patients/<code>", methods=["GET", "DELETE"])
def patient_detail(code: str):
    if request.method == "GET":
        record = scheduler.get_patient(code)
        if record is None:
            return jsonify({"error": "Không tìm thấy bệnh nhân."}), 404
        return jsonify({"patient": record})

    removed = scheduler.remove_patient(code)
    if removed is None:
        return jsonify({"error": "Không tìm thấy bệnh nhân."}), 404
    return jsonify(
        {
            "message": f"Đã xoá bệnh nhân {removed['code']}.",
            "removed": removed,
            "state": build_state(),
        }
    )


@app.route("/api/patients/demo", methods=["POST"])
def demo_patients():
    payload = request.get_json(silent=True) or {}
    count = int(payload.get("count", 5))
    severity = payload.get("severity", "random")
    
    # Validate severity
    if severity != "random":
        try:
            severity_int = int(severity)
            if not (1 <= severity_int <= 10):
                severity = "random"
        except (ValueError, TypeError):
            severity = "random"
    
    scheduler.generate_demo(count=count, severity=severity)
    
    severity_msg = f"Level {severity}" if severity != "random" else "ngẫu nhiên"
    return jsonify(
        {
            "message": f"Đã sinh {count} bệnh nhân demo (mức độ {severity_msg}).",
            "state": build_state(),
        }
    )


@app.route("/api/patients/reset", methods=["POST"])
def reset_patients():
    scheduler.reset()
    return jsonify({"message": "Đã reset hệ thống.", "state": build_state()})


@app.route("/api/logs/clear", methods=["POST"])
def clear_logs():
    scheduler.clear_logs()
    return jsonify({"message": "Đã xoá toàn bộ log.", "state": build_state()})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(debug=True, port=port)

