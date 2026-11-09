import type { Scenario } from "../../types";
export const scenarios: Scenario[] = [
  {
    id: "normal-ab",
    name: "Một tàu A → B",
    description: "Tàu hàng đi hết luồng từ đầu A. Tín hiệu sạch.",
    expected: "Xác nhận AB, hoàn tất một lượt và trả về FREE.",
    ships: [{ at: 0, direction: "AB", type: "cargo" }],
    duration: 40,
    truthPlan: "Một lượt AB; không có tàu đối hướng.",
  },
  {
    id: "normal-ba",
    name: "Một tàu B → A",
    description: "Tàu cá đi hết luồng từ đầu B.",
    expected: "Xác nhận BA, hoàn tất một lượt và trả về FREE.",
    ships: [{ at: 0, direction: "BA", type: "fishing" }],
    duration: 40,
    truthPlan: "Một lượt BA; không có tàu đối hướng.",
  },
  {
    id: "conflict",
    name: "Tiếp cận ngược chiều",
    description: "Tàu thứ hai vào từ B sau 5 giây khi tàu A chưa rời luồng.",
    expected:
      "Cảnh báo nguy cơ; giữ trạng thái bảo thủ nếu thứ tự tín hiệu mơ hồ.",
    ships: [
      { at: 0, direction: "AB" },
      { at: 5, direction: "BA" },
    ],
    duration: 45,
    truthPlan: "Hai tàu đối hướng cùng chiếm dụng luồng.",
  },
  {
    id: "simultaneous",
    name: "Đến gần như đồng thời",
    description: "Hai tàu tiếp cận hai đầu cách nhau 0,2 giây.",
    expected: "Cảnh báo khi hai chuỗi tiếp cận xuất hiện.",
    ships: [
      { at: 0, direction: "AB" },
      { at: 0.2, direction: "BA" },
    ],
    duration: 40,
    truthPlan: "Hai tàu đối hướng cùng chiếm dụng luồng.",
  },
  {
    id: "convoy",
    name: "Cùng chiều, cách nhau",
    description:
      "Hai tàu A → B cách nhau 5 giây; cảm biến có khoảng trống giữa hai xung.",
    expected: "Theo dõi hai lượt AB, không cảnh báo đối hướng.",
    ships: [
      { at: 0, direction: "AB" },
      { at: 5, direction: "AB", type: "transport" },
    ],
    duration: 45,
    truthPlan: "Hai lượt AB; không có tàu đối hướng.",
  },
  {
    id: "stopped",
    name: "Dừng giữa luồng",
    description: "Tàu dừng tại tâm luồng, không phát chuỗi ra đầy đủ.",
    expected: "Giữ chiếm dụng; timeout chuyển FAULT, không tự giải phóng.",
    ships: [{ at: 0, direction: "AB", stopAt: 0 }],
    duration: 85,
    truthPlan: "Một tàu đứng trong luồng; không hoàn tất hành trình.",
  },
  {
    id: "reverse",
    name: "Quay đầu giữa luồng",
    description: "Tàu A đổi hướng tại tâm luồng và trở về A.",
    expected:
      "Chuỗi đảo bất thường chuyển UNCERTAIN/FAULT; không suy đoán một lượt hoàn tất.",
    ships: [{ at: 0, direction: "AB", reverseAt: 0 }],
    duration: 80,
    truthPlan: "Tàu quay lại đầu xuất phát; không có lượt AB/BA hoàn tất.",
  },
  {
    id: "noise",
    name: "Nhiễu tín hiệu",
    description: "Một tàu AB với xung giả, bounce, dropout và độ trễ.",
    expected: "So sánh chống nhiễu; có thể giữ FAULT nếu mất bằng chứng.",
    ships: [{ at: 0, direction: "AB" }],
    duration: 45,
    noise: {
      enabled: true,
      probability: 0.6,
      falseTrigger: 0.08,
      dropout: 0.04,
      bounce: 0.4,
      delay: 0.12,
    },
    truthPlan: "Một lượt AB, không có xung đột vật lý.",
  },
  {
    id: "missing",
    name: "Cảm biến mất tín hiệu",
    description: "A2 bị mất tín hiệu từ đầu phiên.",
    expected: "Không xác nhận chuỗi thiếu A2; timeout FAULT.",
    ships: [{ at: 0, direction: "AB" }],
    duration: 80,
    fault: { sensor: "A2", mode: "missing", from: 0 },
    truthPlan: "Một lượt AB, cảm biến A2 không báo.",
  },
  {
    id: "continuous",
    name: "Lưu lượng liên tục",
    description: "Sáu tàu xen kẽ hai đầu, thời điểm sinh theo khoảng cấu hình.",
    expected: "Phát hiện nguy cơ và ghi nhận các chuỗi không phân biệt được.",
    ships: Array.from({ length: 6 }, (_, i) => ({
      at: i * 4,
      direction: i % 2 ? "BA" : "AB",
      type: i % 3 === 0 ? "fishing" : "cargo",
    })),
    duration: 65,
    truthPlan: "Lịch spawn định trước; ground truth tính từ chiếm dụng thực.",
  },
  {
    id: "stuck",
    name: "Cảm biến bị che liên tục",
    description: "B2 bị kẹt mức cao từ giây thứ 2.",
    expected: "Phát hiện mức cao quá 12 giây, giữ FAULT.",
    ships: [{ at: 0, direction: "AB" }],
    duration: 55,
    fault: { sensor: "B2", mode: "stuck", from: 2 },
    truthPlan: "Một lượt AB; B2 bị kẹt.",
  },
  {
    id: "close",
    name: "Hai tàu đi sát nhau",
    description:
      "Hai tàu cùng hướng cách nhau 0,8 giây; xung cảm biến nhập làm một.",
    expected:
      "Bốn cảm biến không thể đếm chắc số tàu trong xung nhập. Xem giới hạn nhận dạng.",
    ships: [
      { at: 0, direction: "AB" },
      { at: 0.8, direction: "AB" },
    ],
    duration: 45,
    truthPlan:
      "Hai lượt AB; không có tàu đối hướng. Số tàu không quan sát được từ xung nhập.",
  },
  {
    id: "on-sensor",
    name: "Dừng trên cảm biến",
    description: "Tàu dừng tại A2 và che cảm biến liên tục.",
    expected: "Báo cảm biến che quá lâu; không giải phóng chiếm dụng.",
    ships: [{ at: 0, direction: "AB", stopAt: -30 }],
    duration: 55,
    truthPlan: "Tàu dừng tại cửa luồng; không hoàn tất.",
  },
];
export const getScenario = (id: string): Scenario =>
  id === "free"
    ? {
        id: "free",
        name: "Mô phỏng tự do",
        description: "Phiên trống để thêm tàu thủ công.",
        expected: "Theo dõi các tín hiệu thực sự phát sinh.",
        ships: [],
        duration: 60,
        truthPlan:
          "Không có lịch tàu định trước; ground truth được tính từ các tàu người dùng tạo.",
      }
    : (scenarios.find((s) => s.id === id) ?? scenarios[0]);
