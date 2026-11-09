import { expect, test, type Page } from "@playwright/test";
async function position(page: Page, id = "PT-001") {
  return Number(await page.getByTestId(`ship-${id}`).getAttribute("data-x"));
}
async function dragShip(page: Page, dx: number, dy = 0, id = "PT-001") {
  const box = await page
    .getByTestId(`ship-${id}`)
    .locator("path")
    .first()
    .boundingBox();
  if (!box) throw new Error("Không tìm thấy tàu");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + dx,
    box.y + box.height / 2 + dy,
    { steps: 16 },
  );
  await page.mouse.up();
}
test("simple simulation: drag paused ship and sensors respond, without dashboard navigation", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Thử điều khiển luồng tàu" }),
  ).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  const before = await position(page);
  await dragShip(page, 90, 15);
  await expect.poll(() => position(page)).toBeGreaterThan(before + 5);
  await expect(page.getByTestId("simulation-clock")).toHaveText("00:00.0");
  await expect(page.getByTestId("selected-x")).toBeVisible();
  await page.screenshot({ path: "artifacts/simulator-2d.png", fullPage: true });
  await page.getByRole("button", { name: "Đặt lại mô phỏng" }).click();
  await expect.poll(() => position(page)).toBe(-43);
  await expect(page.getByTestId("sensor-status-A1")).toHaveAttribute(
    "data-active",
    "true",
  );
});
test("drag remains accurate after zoom and pan; movement survives switching views", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Phóng to bản đồ" }).click();
  await page.getByRole("button", { name: "Phóng to bản đồ" }).click();
  const svg = page.getByRole("img", { name: "Bản đồ cảng 2D" }),
    bounds = await svg.boundingBox();
  if (!bounds) throw new Error("Không có bản đồ");
  await page.mouse.move(
    bounds.x + bounds.width * 0.6,
    bounds.y + bounds.height * 0.8,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width * 0.6 + 40,
    bounds.y + bounds.height * 0.8 + 12,
    { steps: 5 },
  );
  await page.mouse.up();
  const before = await position(page);
  await dragShip(page, 55);
  await expect.poll(() => position(page)).toBeGreaterThan(before + 2);
  const x = await position(page);
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await expect(page.getByTestId("harbor-3d").locator("canvas")).toBeVisible({
    timeout: 30000,
  });
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await expect.poll(() => position(page)).toBeCloseTo(x, 2);
});
test("drag a ship directly in 3D and continue in 2D", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await page.getByLabel("Góc nhìn 3D").selectOption("top");
  await page.waitForTimeout(900);
  const canvas = page.getByTestId("harbor-3d").locator("canvas"),
    box = await canvas.boundingBox();
  if (!box) throw new Error("Không có canvas");
  const scale = box.height / (2 * 105 * Math.tan(Math.PI / 8));
  const x = box.x + box.width / 2 - 43 * scale,
    y = box.y + box.height / 2 - 2 * scale;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 38, y + 8, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByTestId("selected-x")).toBeVisible();
  await expect
    .poll(async () =>
      Number(await page.getByTestId("selected-x").textContent()),
    )
    .toBeGreaterThan(-40);
  await page.screenshot({ path: "artifacts/simulator-3d.png", fullPage: true });
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await expect.poll(() => position(page)).toBeGreaterThan(-40);
  await page
    .getByRole("button", { name: "Chạy mô phỏng", exact: true })
    .click();
  const current = await position(page);
  await expect.poll(() => position(page)).toBeGreaterThan(current);
  expect(errors).toEqual([]);
});
test("ship controls, conflict scenario, clear and responsive layout", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Loại tàu thêm mới").selectOption("transport");
  await page.getByRole("button", { name: "Từ A → B", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "PT-003", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Vận tốc tàu").fill("0");
  await page.getByRole("button", { name: "Đổi hướng", exact: true }).click();
  await expect(page.locator(".selected-type")).toContainText("B → A");
  await page.getByRole("button", { name: "Xóa tàu đang chọn" }).click();
  await expect(page.getByTestId("ship-PT-003")).toHaveCount(0);
  await page.getByLabel("Kịch bản nhanh").selectOption("conflict");
  await page.getByLabel("Hệ số thời gian").selectOption("4");
  await expect(page.getByTestId("channel-state")).toHaveText(
    "Hai tàu ngược chiều trong luồng",
    { timeout: 15000 },
  );
  await page
    .getByRole("button", { name: "Xóa tất cả tàu", exact: true })
    .click();
  await expect(page.locator(".map-ship")).toHaveCount(0);
  await expect(page.getByTestId("channel-state")).toHaveText("Luồng trống");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("collision demo auto-pauses, marks the exact pair, keeps contact across 3D and clears after separation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "Thử tình huống va chạm", exact: true })
    .click();
  await page.getByLabel("Hệ số thời gian").selectOption("4");
  await expect(page.getByTestId("collision-alert")).toBeVisible({
    timeout: 12000,
  });
  await expect(page.getByTestId("ship-PT-001")).toHaveAttribute(
    "data-colliding",
    "true",
  );
  await expect(page.getByTestId("ship-PT-002")).toHaveAttribute(
    "data-colliding",
    "true",
  );
  await expect(page.getByTestId("collision-marker-2d")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Chạy mô phỏng", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("hull-distance")).toHaveText("0.00");
  await page.screenshot({ path: "artifacts/collision-2d.png", fullPage: true });
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await expect(page.getByTestId("harbor-3d").locator("canvas")).toBeVisible({
    timeout: 30000,
  });
  await page.getByLabel("Góc nhìn 3D").selectOption("collision");
  await page.waitForTimeout(600);
  await expect(page.getByTestId("collision-alert")).toBeVisible();
  await page.screenshot({ path: "artifacts/collision-3d.png", fullPage: true });
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await dragShip(page, -110, 0);
  await expect(page.getByTestId("collision-alert")).toHaveCount(0);
  await expect(page.getByTestId("collision-status")).toHaveText(
    "Chưa có va chạm",
  );
  expect(errors).toEqual([]);
});
test("grounding demo, draft and water level change real model depth and ESP32 sensor packet", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Thử nguy cơ mắc cạn", exact: true })
    .click();
  await page.getByLabel("Hệ số thời gian").selectOption("4");
  await expect(page.getByTestId("grounding-alert")).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByTestId("ship-PT-001")).toHaveAttribute(
    "data-grounding",
    "grounded",
  );
  await expect(
    page.getByRole("button", { name: "Chạy mô phỏng", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Chọn tàu PT-001", exact: true })
    .click();
  await expect(page.getByTestId("underkeel-card")).toContainText("Đã chạm đáy");
  await page.screenshot({ path: "artifacts/grounding-2d.png", fullPage: true });
  await page.getByLabel("Mớn nước tàu").fill("0.7");
  await expect(page.getByTestId("grounding-alert")).toHaveCount(0);
  await page.getByLabel("Mực nước mô phỏng").fill("-1");
  await expect(page.getByTestId("grounding-alert")).toBeVisible();
  await page.getByText("Xem gói tín hiệu cho ESP32", { exact: true }).click();
  const packet = JSON.parse(
    (await page.getByTestId("virtual-esp32-packet").textContent())!,
  );
  expect(packet.source).toBe("simulation");
  expect(packet.sensors.waterLevel).toBe(-1);
  expect(packet.sensors.depthProbes.D_B).toBeCloseTo(0.6);
  expect(Object.keys(packet.sensors.gates)).toEqual(["A1", "A2", "B2", "B1"]);
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await expect(page.getByTestId("harbor-3d").locator("canvas")).toBeVisible({
    timeout: 30000,
  });
  await page.getByLabel("Góc nhìn 3D").selectOption("grounding");
  await expect(page.getByTestId("grounding-alert")).toBeVisible();
});
