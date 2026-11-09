# Port Traffic — Mô phỏng giao thông cảng

Web mô phỏng tương tác đơn giản bằng React, TypeScript, SVG và Three.js. Một màn hình duy nhất, có 2D, 3D và chia đôi. Không có dashboard nghiên cứu, kết nối phần cứng hoặc trang thống kê.

## Website và mã nguồn

- Website: https://remyvnkhiemtruong.github.io/portsimulator/
- Repository: https://github.com/remyvnkhiemtruong/portsimulator

GitHub Actions kiểm thử, build và triển khai GitHub Pages sau mỗi lần push vào `main`. Bản Pages dùng `VITE_BASE_PATH=/portsimulator/`; chạy cục bộ giữ đường dẫn `/`. Không đưa `node_modules`, bản build, tệp ZIP và ảnh kiểm thử vào Git.

## Khởi chạy

Yêu cầu Node.js 22.12+ và npm.

```bash
npm ci
npm run dev
```

Build và chạy bản production:

```bash
npm run build
npm run preview
```

## Sử dụng

- Hai tàu có sẵn để thử ngay. **Giữ chuột trên thân tàu và kéo** đến vị trí mới trong cả 2D và 3D. Tàu được giới hạn trong vùng nước.
- Trong khi kéo, chỉ tàu đang giữ tạm dừng chuyển động tự động. Những tàu khác và đồng hồ vẫn chạy; nếu bật tự dừng khi có sự cố, toàn bộ mô phỏng sẽ tạm dừng lúc phát hiện va chạm/chạm đáy. Khi mô phỏng tạm dừng, kéo tàu không làm tăng đồng hồ.
- Kéo nền bản đồ để pan; cuộn chuột hoặc dùng nút +/− để zoom. 3D có các góc nhìn, OrbitControls và chế độ theo tàu đang chọn.
- Chọn tàu để chỉnh vận tốc, đổi hướng hoặc xóa. Vận tốc 0 cho phép giữ tàu đứng yên.
- Chọn loại tàu và thêm từ A/B. Các kịch bản nhanh gồm một tàu AB/BA, hai tàu đối hướng, cùng chiều, va chạm trực diện và tàu đi vào bãi nông.
- **Đặt lại** đưa về hai tàu ban đầu; **Xóa tất cả tàu** tạo vùng mô phỏng trống.
- Cảm biến A1/A2/B2/B1 đổi trạng thái trực tiếp theo thân tàu, kể cả khi kéo lúc tạm dừng. Màu vàng cho nguy cơ/đối hướng, màu đỏ cho tiếp xúc thân tàu, màu hổ phách cho chạm đáy.
- Chuyển 2D/3D không đặt lại vị trí hoặc thời gian. Trong 2D, có thể chọn tàu bằng Tab và dùng phím mũi tên để di chuyển.

Tọa độ là đơn vị mô phỏng; tốc độ tính bằng đv/s. Vùng luồng là đoạn x=[−30,30], vị trí kéo được giới hạn x=[−62,62], y=[−7,7]. Cảnh báo dựa trên quy tắc chiếm dụng của mô hình, không phải tính toán va chạm hàng hải.

## Va chạm và nguy cơ mắc cạn

- **Thử tình huống va chạm** cho hai tàu chạy cùng đường đối hướng. Khi hai đường bao thân tàu tiếp xúc, đánh dấu đúng cặp tàu bằng màu đỏ, hiện vùng tiếp xúc trong 2D/3D và tự tạm dừng nếu tùy chọn đang bật. Kéo tách tàu để kết thúc tiếp xúc. Camera 3D có **Cận cảnh va chạm**.
- Va chạm được kiểm tra bằng SAT trên đa giác lồi năm đỉnh của thân tàu, gồm phần mũi thuôn; không chỉ dùng hình chữ nhật bao quanh. 2D/3D dùng cùng đường bao. Khoảng hở là khoảng cách ngắn nhất giữa hai mép thân, không phải khoảng cách hai tâm tàu. Chạm cạnh cũng được tính tiếp xúc. Một đợt tiếp xúc chỉ được đếm một lần; tách rồi chạm lại tạo đợt mới.
- Hai tàu đối hướng cùng ở trong luồng nhưng chưa chạm nhau chỉ hiện cảnh báo màu vàng. Không gọi cảnh báo này là va chạm.
- **Thử nguy cơ mắc cạn** đưa tàu qua rìa bãi bồi rồi vào vùng nông hơn. Độ sâu tối thiểu dưới **toàn bộ đường bao thân tàu** được so với mớn nước. Khoảng hở dưới đáy = độ sâu + biến thiên mực nước − mớn nước.
- Khoảng hở ≤ 0,6 đv: cảnh báo nguy cơ mắc cạn; ≤ 0: chạm đáy trong mô hình. Bản đồ vàng hiển thị bãi nông; chọn tàu để xem độ sâu, khoảng hở và chỉnh mớn nước. Camera 3D có **Cận cảnh mắc cạn**. Tăng mực nước hoặc kéo về vùng sâu để thử tình huống khác.
- Các nút **Thân tàu / Vệt tàu / Khoảng hở / Độ sâu** chỉ bật/tắt lớp quan sát; không thay đổi logic phát hiện.
- Phát hiện chuyển động tự động dùng bước 20 ms. Kéo chuột được chia thành bước không quá 0,25 đv để ghi nhận cả lần kéo nhanh xuyên qua tàu khác. Không mô phỏng xung lực, biến dạng, hư hỏng hoặc thủy động lực học.

Độ sâu nền là 5,5 đv; các bãi nông có độ sâu cơ sở 1,2–2,3 đv. Đây là số liệu giả định phục vụ mô phỏng, không phải địa hình đo tại cảng thật. Các vùng độ sâu được mô hình hóa thành đa giác theo bậc, chưa có thủy triều/dòng chảy hoặc dự báo hàng hải thực tế.

## Cảm biến mô phỏng cho ESP32

Khung **Cảm biến ESP32 ảo** hiển thị các giá trị được tính từ thế giới mô phỏng:

| Nhóm | Nguyên lý mô phỏng |
| --- | --- |
| A1/A2/B2/B1 | Cảm biến chắn tia dạng nhị phân, báo 1 khi thân tàu che vùng trạm; có rising/falling edges. |
| US_A/US_B | Tia đo khoảng cách cố định ngang luồng tại x=−30/+30. Raycast với đa giác thân tàu, lấy echo gần nhất trong tầm 22 đv; ngoài tia/tầm đo là `null`, không tự bịa giá trị. |
| D_A/D_B | Đầu đo độ sâu ảo tại hai bãi bồi, lấy độ sâu địa hình cộng với mực nước do người dùng chỉnh. |

Mở **Xem gói tín hiệu cho ESP32** để xem/sao chép JSON. Gói có `source:"simulation"`, `deviceId`, `bootId`, `timestamp`, đơn vị giả định, trạng thái các trạm, khoảng cách, mức nước, đầu đo độ sâu và 16 cạnh gần nhất kèm sequence. Timestamp là giây mô phỏng; kéo tàu trong lúc tạm dừng có thể tạo nhiều cạnh cùng timestamp nhưng sequence khác nhau. Khi nối phần cứng thật sau này cần cung cấp GPIO/driver, calibration, buffer và giao thức truyền phù hợp.

**A1…B1 không tự đo được khoảng cách hoặc độ sâu.** Cảnh báo va chạm/chạm đáy trên bản đồ là kết quả hình học của simulator, không phải tuyên bố bốn cảm biến đó nhận biết được mọi sự cố. Packet cảm biến không đưa ID, tọa độ tàu hoặc ground truth vào dữ liệu đo. Chưa có kết nối ESP32 thật, chưa triển khai firmware hoặc kiểm tra loại cảm biến vật lý cụ thể. Đầu đo độ sâu ảo không đại diện cho khả năng của một cảm biến siêu âm trên không bất kỳ.

## Kiểm thử

```bash
npm test
npx playwright install chromium
npm run test:e2e
```

Các kiểm thử trình duyệt kiểm tra kéo tàu 2D, kéo sau zoom/pan, kéo 3D, đồng bộ hai chế độ, cảm biến, điều khiển tàu, xóa/reset và giao diện màn hình nhỏ. Logic mô phỏng và thao tác kéo được kiểm thử bằng Vitest.

Playwright tự build và khởi động bản production tại cổng 4180 để kiểm tra đúng bản phát hành, tách khỏi máy chủ development. Cổng 4180 cần trống khi chạy kiểm thử.

Kiểm thử bổ sung bao phủ tiếp xúc cạnh/mũi tàu, khoảng cách mép thân, nhiều cặp chạm nhau, đếm đợt tiếp xúc, kéo xuyên nhanh, tách va chạm khỏi xung đột luồng, chạm đáy theo toàn bộ thân, thay mớn nước/mực nước và các giá trị raycast/JSON cảm biến ảo.

## Cấu trúc

- `src/App.tsx`: màn hình mô phỏng và các điều khiển.
- `src/stores/`: engine dùng chung, tàu đang chọn và chế độ xem.
- `src/simulation/`: chuyển động, cảm biến và kịch bản.
- `src/visualization/2d/`: SVG, chuyển đổi tọa độ chuột qua ma trận SVG, kéo tàu.
- `src/visualization/3d/`: hình học Three.js, giao tia chuột với mặt phẳng nước, kéo tàu và camera.
- `src/algorithms/`: bộ xử lý cảm biến nội bộ; không có trang nghiên cứu/so sánh trong giao diện.

Không cần API key, backend, CDN hoặc tải model 3D. Ứng dụng chạy offline khi đã cài dependencies và được phục vụ qua HTTP cục bộ. Chưa xác minh 60 FPS trên mọi thiết bị; có lựa chọn đồ họa nhẹ và fallback 2D khi thiếu WebGL.

Chỉ là phần mềm mô phỏng, không dùng điều khiển giao thông hoặc bảo đảm an toàn hàng hải thực tế.
