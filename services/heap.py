from __future__ import annotations

import itertools
import random
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional


SEVERITY_BUCKETS = [
    ((10, 10), "Nguy kịch"),
    ((7, 9), "Nguy hiểm cao"),
    ((5, 6), "Trung bình"),
    ((3, 4), "Nhẹ"),
    ((1, 2), "Rất nhẹ"),
]


def severity_label(value: int) -> str:
    for (low, high), label in SEVERITY_BUCKETS:
        if low <= value <= high:
            return label
    return "Không xác định"


def parse_timestamp(value: str) -> float:
    """Convert ISO string to timestamp for ordering."""
    normalized = value.replace("Z", "+00:00") if value.endswith("Z") else value
    try:
        return datetime.fromisoformat(normalized).timestamp()
    except ValueError as exc:
        raise ValueError("Thời điểm nhập viện phải đúng định dạng ISO.") from exc


def human_time(value: str) -> str:
    try:
        normalized = value.replace("Z", "+00:00") if value.endswith("Z") else value
        return datetime.fromisoformat(normalized).strftime("%d/%m/%Y %H:%M")
    except ValueError:
        return value


@dataclass
class Patient:
    code: str
    name: str
    admitted_at: str
    severity: int

    @property
    def label(self) -> str:
        return severity_label(self.severity)

    def to_dict(self) -> Dict[str, Any]:
        payload = asdict(self)
        payload["label"] = self.label
        payload["admittedAtDisplay"] = human_time(self.admitted_at)
        return payload


class EmergencyHeapSimple:
    """
    

    - Ưu tiên 1: severity lớn hơn.
    - Ưu tiên 2: thời điểm nhập viện sớm hơn.
    - Ưu tiên 3: vào hệ thống sớm hơn (order nhỏ hơn).

    
    """

    def __init__(self) -> None:
        # mỗi phần tử là tuple (patient, admitted_ts, order)
        self._nodes: List[tuple[Patient, float, int]] = []
        self._order_counter = 0

    # ---- Hàm so sánh độ ưu tiên giữa 2 node ----
    def _higher_priority(self, a: tuple[Patient, float, int], b: tuple[Patient, float, int]) -> bool:
        pa, ta, oa = a
        pb, tb, ob = b

        # 1) severity lớn hơn -> ưu tiên hơn
        if pa.severity != pb.severity:
            return pa.severity > pb.severity

        # 2) cùng severity: ai nhập viện sớm hơn (timestamp nhỏ hơn) -> ưu tiên
        if ta != tb:
            return ta < tb

        # 3) cùng thời điểm nhập viện: ai vào hệ thống trước (order nhỏ hơn) -> ưu tiên
        return oa < ob

    # ---- Sift-up: đẩy node mới lên trên ----
    def _sift_up(self, index: int) -> None:
        while index > 0:
            parent = (index - 1) // 2
            if self._higher_priority(self._nodes[index], self._nodes[parent]):
                self._nodes[index], self._nodes[parent] = self._nodes[parent], self._nodes[index]
                index = parent
            else:
                break

    # ---- Sift-down: đẩy node xuống dưới ----
    def _sift_down(self, index: int) -> None:
        size = len(self._nodes)
        while True:
            left = 2 * index + 1
            right = 2 * index + 2
            highest = index

            if left < size and self._higher_priority(self._nodes[left], self._nodes[highest]):
                highest = left
            if right < size and self._higher_priority(self._nodes[right], self._nodes[highest]):
                highest = right

            if highest != index:
                self._nodes[index], self._nodes[highest] = self._nodes[highest], self._nodes[index]
                index = highest
            else:
                break

    # ---- Thêm bệnh nhân ----
    def add_patient(self, code: str, name: str, admitted_at: str, severity: int) -> None:
        """
        B1: Tạo đối tượng Patient.
        B2: Đưa node mới vào cuối mảng.
        B3: Gọi _sift_up để đưa node về đúng vị trí trong Max-Heap.
        """
        patient = Patient(code=code, name=name, admitted_at=admitted_at, severity=severity)
        admitted_ts = parse_timestamp(admitted_at)
        self._order_counter += 1
        node = (patient, admitted_ts, self._order_counter)

        self._nodes.append(node)
        self._sift_up(len(self._nodes) - 1)

    # ---- Lấy bệnh nhân ưu tiên nhất ----
    def extract_next(self) -> Optional[Patient]:
        """
        B1: Lấy node gốc (index 0).
        B2: Đưa node cuối cùng lên gốc.
        B3: Gọi _sift_down để khôi phục tính chất heap.
        """
        if not self._nodes:
            return None

        root_patient, _, _ = self._nodes[0]
        last = self._nodes.pop()
        if self._nodes:
            self._nodes[0] = last
            self._sift_down(0)

        return root_patient

    # ---- Hàm phụ để minh hoạ trên lớp ----
    def as_array(self) -> List[str]:
        """Trả về danh sách mã bệnh nhân theo thứ tự mảng heap."""
        return [node[0].code for node in self._nodes]


@dataclass
class HeapNode:
    patient: Patient
    admitted_ts: float
    order: int

    def to_dict(self, index: int) -> Dict[str, Any]:
        data = self.patient.to_dict()
        data.update({"index": index})
        return data


class EmergencyHeap:
    """Max-Heap minh hoạ rõ từng bước insert/extract."""

    def __init__(self) -> None:
        self._nodes: List[HeapNode] = []
        self._order = itertools.count(1)
        self._logs: List[Dict[str, str]] = []
        self._last_steps: List[Dict[str, Any]] = []

    # ---------- Helpers ----------
    def _snapshot(self) -> List[Dict[str, Any]]:
        return [
            {
                "index": idx,
                "code": node.patient.code,
                "severity": node.patient.severity,
                "label": node.patient.label,
            }
            for idx, node in enumerate(self._nodes)
        ]

    def _add_step(
        self,
        title: str,
        description: str,
        focus: Optional[List[int]] = None,
        swap: Optional[List[int]] = None,
    ) -> None:
        self._last_steps.append(
            {
                "title": title,
                "description": description,
                "focus": focus or [],
                "swap": swap or [],
                "array": self._snapshot(),
            }
        )

    def _higher_priority(self, child: HeapNode, parent: HeapNode) -> bool:
        if child.patient.severity != parent.patient.severity:
            return child.patient.severity > parent.patient.severity
        if child.admitted_ts != parent.admitted_ts:
            return child.admitted_ts < parent.admitted_ts
        return child.order < parent.order

    def _swap(self, i: int, j: int) -> None:
        self._nodes[i], self._nodes[j] = self._nodes[j], self._nodes[i]

    def _sift_up(self, index: int) -> None:
        while index > 0:
            parent = (index - 1) // 2
            child_node = self._nodes[index]
            parent_node = self._nodes[parent]
            self._add_step(
                "So sánh với cha",
                f"So sánh {child_node.patient.code} với cha {parent_node.patient.code}.",
                focus=[index, parent],
            )
            if self._higher_priority(child_node, parent_node):
                self._swap(index, parent)
                self._add_step(
                    "Hoán vị (sift-up)",
                    f"{child_node.patient.code} có độ ưu tiên cao hơn nên hoán đổi với {parent_node.patient.code}.",
                    focus=[index, parent],
                    swap=[index, parent],
                )
                index = parent
            else:
                self._add_step(
                    "Dừng sift-up",
                    f"{child_node.patient.code} không cao hơn cha nên dừng.",
                    focus=[index, parent],
                )
                break

    def _sift_down(self, index: int) -> None:
        size = len(self._nodes)
        while True:
            left = 2 * index + 1
            right = 2 * index + 2
            highest = index

            if left < size and self._higher_priority(self._nodes[left], self._nodes[highest]):
                highest = left
            if right < size and self._higher_priority(self._nodes[right], self._nodes[highest]):
                highest = right

            if highest != index:
                self._add_step(
                    "So sánh với con",
                    f"Chọn con ưu tiên nhất tại vị trí {highest}.",
                    focus=[index, highest],
                )
                self._swap(index, highest)
                self._add_step(
                    "Hoán vị (sift-down)",
                    "Đẩy node xuống để khôi phục thuộc tính heap.",
                    focus=[index, highest],
                    swap=[index, highest],
                )
                index = highest
            else:
                self._add_step("Heap ổn định", "Không còn con nào ưu tiên hơn.", focus=[index])
                break

    def _ensure_unique_code(self, code: str) -> None:
        if any(node.patient.code == code for node in self._nodes):
            raise ValueError(f"Mã bệnh nhân {code} đã tồn tại.")

    def _record_log(self, message: str) -> None:
        now = datetime.now().strftime("%H:%M:%S")
        self._logs.append({"time": now, "message": message})

    # ---------- Public API ----------
    def add_patient(self, code: str, name: str, admitted_at: str, severity: int) -> Dict[str, Any]:
        if not code or not name or not admitted_at:
            raise ValueError("Vui lòng nhập đầy đủ thông tin.")
        if not (1 <= severity <= 10):
            raise ValueError("Mức độ nguy kịch phải nằm trong khoảng 1-10.")
        self._ensure_unique_code(code.strip())

        patient = Patient(
            code=code.strip(),
            name=name.strip(),
            admitted_at=admitted_at,
            severity=severity,
        )
        node = HeapNode(patient=patient, admitted_ts=parse_timestamp(admitted_at), order=next(self._order))

        self._last_steps = []
        self._nodes.append(node)
        self._add_step(
            "Bước 1: Thêm vào mảng",
            f"Đưa {patient.code} vào cuối mảng heap.",
            focus=[len(self._nodes) - 1],
        )
        if len(self._nodes) > 1:
            self._add_step("Bước 2: Sift-up", "So sánh với cha để duy trì Max-Heap.", focus=[len(self._nodes) - 1])
            self._sift_up(len(self._nodes) - 1)
        else:
            self._add_step("Heap chỉ có 1 node", "Không cần sift-up.", focus=[0])

        self._record_log(f"Đã thêm bệnh nhân {patient.code} (Level {patient.severity}).")
        return patient.to_dict()

    def extract_next(self) -> Optional[Dict[str, Any]]:
        if not self._nodes:
            self._last_steps = []
            return None

        self._last_steps = []
        root = self._nodes[0]
        self._add_step("Bước 1: Lấy gốc", f"Lấy bệnh nhân ưu tiên nhất {root.patient.code}.", focus=[0])
        last = self._nodes.pop()
        if self._nodes:
            self._nodes[0] = last
            self._add_step("Bước 2: Đưa node cuối lên gốc", "Thực hiện sift-down để khôi phục heap.", focus=[0])
            self._sift_down(0)
        else:
            self._add_step("Heap trống", "Không còn phần tử nào sau khi lấy gốc.", focus=[])

        self._record_log(f"Xử lý bệnh nhân {root.patient.code} (Level {root.patient.severity}).")
        return root.patient.to_dict()

    def remove_patient(self, code: str) -> Optional[Dict[str, Any]]:
        self._last_steps = []
        for index, node in enumerate(self._nodes):
            if node.patient.code == code:
                removed = self._nodes[index]
                self._add_step(
                    "Tìm bệnh nhân",
                    f"Thấy {code} tại vị trí {index}, thay bằng node cuối rồi heapify.",
                    focus=[index],
                )
                last = self._nodes.pop()
                if index < len(self._nodes):
                    self._nodes[index] = last
                    parent = (index - 1) // 2
                    if index > 0 and self._higher_priority(self._nodes[index], self._nodes[parent]):
                        self._sift_up(index)
                    else:
                        self._sift_down(index)
                self._record_log(f"Đã xoá bệnh nhân {code}.")
                return removed.patient.to_dict()
        return None

    def get_patient(self, code: str) -> Optional[Dict[str, Any]]:
        for node in self._nodes:
            if node.patient.code == code:
                return node.patient.to_dict()
        return None

    def peek(self) -> Optional[Dict[str, Any]]:
        if not self._nodes:
            return None
        return self._nodes[0].patient.to_dict()

    def to_priority_list(self) -> List[Dict[str, Any]]:
        ordered = sorted(
            self._nodes,
            key=lambda node: (-node.patient.severity, node.admitted_ts, node.order),
        )
        return [node.patient.to_dict() for node in ordered]

    def to_heap_array(self) -> List[Dict[str, Any]]:
        return [node.to_dict(idx) for idx, node in enumerate(self._nodes)]

    def stats(self) -> Dict[str, Any]:
        buckets = {label: 0 for _, label in SEVERITY_BUCKETS}
        for node in self._nodes:
            buckets[node.patient.label] += 1
        return {"total": len(self._nodes), "buckets": buckets}

    def severity_mapping(self) -> List[Dict[str, str]]:
        mapping: List[Dict[str, str]] = []
        for (low, high), label in SEVERITY_BUCKETS:
            rng = f"{low}" if low == high else f"{low}-{high}"
            mapping.append({"range": rng, "label": label})
        return mapping

    def logs(self) -> List[Dict[str, str]]:
        return list(reversed(self._logs[-120:]))

    def clear_logs(self) -> None:
        self._logs.clear()

    def last_steps(self) -> List[Dict[str, Any]]:
        return self._last_steps

    def generate_demo(self, count: int = 5, severity: str = "random") -> None:
        """
        Tạo bệnh nhân demo.
        
        Args:
            count: Số lượng bệnh nhân cần tạo
            severity: "random" hoặc số từ 1-10. Nếu "random" thì mỗi bệnh nhân có level ngẫu nhiên,
                     nếu là số thì tất cả bệnh nhân có cùng level đó.
        """
        names = [
            "Nguyễn An",
            "Trần Bình",
            "Lê Chi",
            "Phạm Dũng",
            "Hoàng Em",
            "Vũ Gia",
            "Đặng Hoa",
            "Lý Khang",
            "Đỗ Lan",
        ]
        # Xác định severity cho từng bệnh nhân
        if severity == "random":
            severity_func = lambda: random.randint(1, 10)
        else:
            try:
                fixed_severity = int(severity)
                if not (1 <= fixed_severity <= 10):
                    fixed_severity = random.randint(1, 10)
                severity_func = lambda: fixed_severity
            except (ValueError, TypeError):
                severity_func = lambda: random.randint(1, 10)
        
        for _ in range(count):
            code = f"BN{len(self._nodes) + random.randint(1, 999):03d}"
            name = random.choice(names)
            patient_severity = severity_func()
            admitted_time = (datetime.now() - timedelta(minutes=random.randint(0, 120))).strftime(
                "%Y-%m-%dT%H:%M:%S"
            )
            try:
                self.add_patient(code, name, admitted_time, patient_severity)
            except ValueError:
                continue

    def reset(self) -> None:
        self._nodes.clear()
        self._logs.clear()
        self._last_steps = []
        self._order = itertools.count(1)

