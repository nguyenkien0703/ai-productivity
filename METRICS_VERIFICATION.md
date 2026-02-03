# Metrics Verification Guide

Tài liệu này mô tả chi tiết cách tính toán các metrics trong AI Productivity Dashboard.
Bạn có thể sử dụng các lệnh bên dưới để tự verify số liệu.

---

## Yêu cầu trước khi chạy commands

1. **Server phải đang chạy** trên `localhost:3004`
   ```bash
   npm run dev
   ```

2. **Cần cài đặt `jq`** để parse JSON
   ```bash
   # macOS
   brew install jq

   # Ubuntu/Debian
   sudo apt install jq
   ```

---

## Thông tin cấu hình

| Config | Value |
|--------|-------|
| Pivot Date | **2025-07-01** (ngày join công ty mới) |
| GitHub Repos | `DefikitTeam/lumilink-be`, `DefikitTeam/lumilink-fe` |
| Jira Project | **AAP** |
| Jira URL | `https://jira.savameta.com` |

---

## 1. GitHub PR Metrics

### 1.1 Giải thích về Proxy Server

Dashboard sử dụng **proxy server** (`server.js` chạy trên port 3004) để gọi GitHub API.

**Tại sao cần proxy?**
- GitHub token được lưu trong `.env` trên server
- Không expose token ra browser/terminal
- Server tự động thêm authentication header

**Flow khi gọi API:**
```
Terminal/Browser → localhost:3004/api/github/... → api.github.com → Response
```

### 1.2 Cách lấy dữ liệu PR

**Command:**
```bash
curl -s "http://localhost:3004/api/github/repos/DefikitTeam/lumilink-be/pulls?state=all&per_page=100&page=1"
```

**Giải thích từng phần:**

| Phần | Ý nghĩa |
|------|---------|
| `curl -s` | Gọi HTTP GET request. `-s` = silent (không hiện progress bar) |
| `http://localhost:3004` | Địa chỉ proxy server đang chạy |
| `/api/github/` | Prefix để proxy biết forward đến GitHub API |
| `repos/DefikitTeam/lumilink-be/pulls` | GitHub API endpoint: lấy danh sách PRs của repo |
| `?state=all` | Lấy TẤT CẢ PRs (bao gồm open, closed, merged) |
| `&per_page=100` | Trả về tối đa 100 PRs mỗi request |
| `&page=1` | Lấy trang số 1 (pagination) |

**Response trả về:** JSON array chứa danh sách PRs

### 1.3 Đếm tổng số PRs

**Mục đích:** Đếm tổng PRs trong mỗi repo (phải loop qua nhiều pages vì mỗi page tối đa 100)

**Command cho lumilink-be:**
```bash
# Loop qua từng page, đếm số PRs, dừng khi page rỗng
for i in {1..10}; do
  count=$(curl -s "http://localhost:3004/api/github/repos/DefikitTeam/lumilink-be/pulls?state=all&per_page=100&page=$i" | jq 'length')
  echo "Page $i: $count PRs"
  if [ "$count" -eq 0 ]; then break; fi
done
```

**Giải thích:**
- `for i in {1..10}` = Loop từ page 1 đến 10
- `jq 'length'` = Đếm số phần tử trong JSON array
- Dừng loop khi `count = 0` (hết data)

**Command cho lumilink-fe:**
```bash
for i in {1..10}; do
  count=$(curl -s "http://localhost:3004/api/github/repos/DefikitTeam/lumilink-fe/pulls?state=all&per_page=100&page=$i" | jq 'length')
  echo "Page $i: $count PRs"
  if [ "$count" -eq 0 ]; then break; fi
done
```

**Kết quả verify (02/2026):**

| Repo | Page 1 | Page 2 | Page 3 | Page 4 | Page 5 | Page 6 | Tổng |
|------|--------|--------|--------|--------|--------|--------|------|
| lumilink-be | 100 | 100 | 100 | 100 | 100 | 84 | **584** |
| lumilink-fe | 100 | 100 | 100 | 100 | 19 | 0 | **419** |
| | | | | | | **Tổng cộng** | **1,003** |

### 1.4 Phân loại Before/After 01/07/2025

**Mục đích:** Đếm có bao nhiêu PRs được tạo TRƯỚC và SAU ngày 01/07/2025

**Công thức phân loại:**
- `Before`: PRs có `created_at < "2025-07-01"`
- `After`: PRs có `created_at >= "2025-07-01"`

**Command đếm PRs BEFORE 01/07/2025:**
```bash
# Đếm PRs có created_at < "2025-07-01" trong page cuối (page có PRs cũ nhất)
curl -s "http://localhost:3004/api/github/repos/DefikitTeam/lumilink-be/pulls?state=all&per_page=100&page=6" | \
  jq '[.[] | select(.created_at < "2025-07-01")] | length'
```

**Giải thích:**
- `jq '[.[] | select(.created_at < "2025-07-01")]'` = Lọc các PRs có `created_at` trước ngày 01/07/2025
- `| length` = Đếm số phần tử sau khi lọc

**Command đếm PRs AFTER 01/07/2025:**
```bash
# Đếm PRs có created_at >= "2025-07-01" trong page 1 (page có PRs mới nhất)
curl -s "http://localhost:3004/api/github/repos/DefikitTeam/lumilink-be/pulls?state=all&per_page=100&page=1" | \
  jq '[.[] | select(.created_at >= "2025-07-01")] | length'
```

**Kết quả verify:**

| Repo | Before 01/07/2025 | After 01/07/2025 | Tổng |
|------|-------------------|------------------|------|
| lumilink-be | 64 | 520 | 584 |
| lumilink-fe | 44 | 375 | 419 |
| **Tổng** | **108** | **895** | **1,003** |

### 1.5 Công thức tính metrics hiển thị trên Dashboard

**1. PR Volume (After AI): +728.7%**
```
PR Volume Increase (%) = (PRs After - PRs Before) / PRs Before × 100
                       = (895 - 108) / 108 × 100
                       = 787 / 108 × 100
                       = 728.7%

Tăng 787 PRs = PRs After - PRs Before = 895 - 108 = 787
```

**2. Productivity Boost: 7.3x**
```
Productivity Boost = PR Volume Increase (%) / 100
                   = 728.7 / 100
                   = 7.287
                   ≈ 7.3x

Ý nghĩa: Số PRs tăng thêm gấp 7.3 lần số PRs ban đầu
```

**3. Key Insight "8.3x"**
```
Output Multiplier = PRs After / PRs Before
                  = 895 / 108
                  = 8.29
                  ≈ 8.3x

Ý nghĩa: Tổng output hiện tại gấp 8.3 lần so với trước
```

**Lưu ý sự khác biệt:**
- **7.3x** = Tỉ lệ TĂNG (increase ratio)
- **8.3x** = Tỉ lệ TỔNG (total output ratio)

### 1.6 Xem chi tiết 1 PR (để verify fields)

**Command:**
```bash
# Xem thông tin 1 PR đầu tiên
curl -s "http://localhost:3004/api/github/repos/DefikitTeam/lumilink-be/pulls?state=all&per_page=1" | \
  jq '.[0] | {number, title, state, created_at, merged_at, user: .user.login}'
```

**Giải thích:**
- `.[0]` = Lấy phần tử đầu tiên trong array
- `{number, title, ...}` = Chỉ hiển thị các fields cần thiết

**Response mẫu:**
```json
{
  "number": 584,
  "title": "fix: update API endpoint",
  "state": "closed",
  "created_at": "2026-01-15T10:30:00Z",
  "merged_at": "2026-01-15T14:20:00Z",
  "user": "developer-name"
}
```

### 1.7 Đếm PRs đã Merged

**Command:**
```bash
# Đếm PRs có merged_at != null (đã được merge)
curl -s "http://localhost:3004/api/github/repos/DefikitTeam/lumilink-be/pulls?state=all&per_page=100&page=1" | \
  jq '[.[] | select(.merged_at != null)] | length'
```

**Giải thích:**
- `select(.merged_at != null)` = Chỉ lấy PRs đã merge (có merged_at)
- PRs bị close mà không merge sẽ có `merged_at = null`

---

## 2. Jira Sprint Metrics

### 2.1 Giải thích về Jira API

Tương tự GitHub, Jira API cũng đi qua proxy server với authentication.

**Flow:**
```
Terminal → localhost:3004/api/jira/... → jira.savameta.com → Response
```

### 2.2 Lấy danh sách Boards

**Command:**
```bash
curl -s "http://localhost:3004/api/jira/rest/agile/1.0/board?projectKeyOrId=AAP" | jq
```

**Giải thích:**
- `/rest/agile/1.0/board` = Jira Agile API endpoint để lấy boards
- `?projectKeyOrId=AAP` = Filter boards thuộc project "AAP"

**Response mẫu:**
```json
{
  "values": [
    {
      "id": 123,
      "name": "AAP Board",
      "type": "scrum"
    }
  ]
}
```

**Ghi lại Board ID** (ví dụ: `123`) để dùng cho các commands tiếp theo.

### 2.3 Lấy danh sách Sprints

**Command:**
```bash
# Thay 123 bằng Board ID thực tế từ bước 2.2
curl -s "http://localhost:3004/api/jira/rest/agile/1.0/board/123/sprint?state=closed" | jq
```

**Giải thích:**
- `/board/123/sprint` = Lấy sprints thuộc board ID 123
- `?state=closed` = Chỉ lấy sprints đã hoàn thành

**Response mẫu:**
```json
{
  "values": [
    {
      "id": 456,
      "name": "Sprint 10",
      "state": "closed",
      "startDate": "2025-08-01T00:00:00.000Z",
      "endDate": "2025-08-14T00:00:00.000Z"
    }
  ]
}
```

### 2.4 Lấy Issues trong Sprint

**Command:**
```bash
# Thay 456 bằng Sprint ID thực tế từ bước 2.3
curl -s "http://localhost:3004/api/jira/rest/agile/1.0/sprint/456/issue?fields=status,customfield_10016" | jq
```

**Giải thích:**
- `/sprint/456/issue` = Lấy issues trong sprint ID 456
- `?fields=status,customfield_10016` = Chỉ lấy fields: status và story points
- `customfield_10016` = Custom field cho Story Points (có thể khác tùy Jira instance)

### 2.5 Công thức tính Sprint Metrics (Chi tiết)

**Phân loại sprints:**
- `Sprints Before`: Sprints có `endDate < "2025-07-01"`
- `Sprints After`: Sprints có `endDate >= "2025-07-01"`

**1. Sprint Completion Rate: 86.2%**

Đây là **trung bình completion rate** của tất cả sprints SAU ngày 01/07/2025.

```
Completion Rate của 1 sprint = (Completed Story Points / Committed Story Points) × 100

Ví dụ Sprint 10:
- Committed: 50 points
- Completed (status = "done"): 43 points
- Completion Rate = 43/50 × 100 = 86%

Sprint Completion Rate (hiển thị) = Trung bình completion rate của tất cả sprints after
                                  = (Sprint1_rate + Sprint2_rate + ... + Sprint14_rate) / 14
                                  = 86.2%
```

**2. 14 sprints completed**

```
Số sprints completed = Số sprints có endDate >= "2025-07-01"
                     = 14 sprints
```

**3. Avg Story Points/Sprint: 63.4**

```
Avg Story Points/Sprint = Total Completed Points (after) / Number of Sprints (after)
                        = 888 / 14
                        = 63.4 points/sprint
```

**4. Total: 888 points**

```
Total Story Points = Tổng tất cả completed story points từ 14 sprints sau 01/07/2025
                   = Sprint1_completed + Sprint2_completed + ... + Sprint14_completed
                   = 888 points
```

### 2.6 Verify Jira Metrics Step-by-Step

**Bước 1: Lấy Board ID**
```bash
curl -s "http://localhost:3004/api/jira/rest/agile/1.0/board?projectKeyOrId=AAP" | jq '.values[0].id'
# Ghi lại Board ID (ví dụ: 15)
```

**Bước 2: Lấy danh sách Sprints**
```bash
# Thay 15 bằng Board ID thực tế
curl -s "http://localhost:3004/api/jira/rest/agile/1.0/board/15/sprint?state=closed,active" | \
  jq '.values | length'
# Output: Số lượng sprints
```

**Bước 3: Xem chi tiết sprints (với endDate)**
```bash
curl -s "http://localhost:3004/api/jira/rest/agile/1.0/board/15/sprint?state=closed,active" | \
  jq '.values[] | {id, name, endDate, state}'
```

**Bước 4: Đếm sprints sau 01/07/2025**
```bash
curl -s "http://localhost:3004/api/jira/rest/agile/1.0/board/15/sprint?state=closed,active" | \
  jq '[.values[] | select(.endDate >= "2025-07-01")] | length'
# Kết quả phải = 14
```

**Bước 5: Lấy issues trong 1 sprint và tính story points**
```bash
# Thay 456 bằng Sprint ID
curl -s "http://localhost:3004/api/jira/rest/agile/1.0/sprint/456/issue?maxResults=1000" | \
  jq '[.issues[] | {
    key: .key,
    status: .fields.status.statusCategory.key,
    storyPoints: (.fields.customfield_10031 // .fields.customfield_10016 // 0)
  }]'
```

**Bước 6: Tính completion rate của 1 sprint**
```bash
# Lấy issues của sprint
curl -s "http://localhost:3004/api/jira/rest/agile/1.0/sprint/456/issue?maxResults=1000" | \
  jq '{
    total: [.issues[].fields | (.customfield_10031 // .customfield_10016 // 0)] | add,
    completed: [.issues[] | select(.fields.status.statusCategory.key == "done") | .fields | (.customfield_10031 // .customfield_10016 // 0)] | add
  }'
# Completion Rate = completed / total × 100
```

---

## 3. Dashboard UI Metrics Summary

Bảng tổng hợp các metrics hiển thị trên Dashboard và cách tính:

### Section "CÁC CHỈ SỐ CẢI THIỆN"

| Metric | Value | Công thức |
|--------|-------|-----------|
| PR Volume (After AI) | +728.7% | `(895 - 108) / 108 × 100` |
| Tăng 787 PRs | 787 | `895 - 108` |
| Sprint Completion Rate | 86.2% | `Trung bình completion rate của 14 sprints sau 01/07/2025` |
| 14 sprints completed | 14 | `Số sprints có endDate >= "2025-07-01"` |
| Avg Story Points/Sprint | 63.4 | `888 total points / 14 sprints` |
| Total: 888 points | 888 | `Tổng completed points từ 14 sprints` |
| Productivity Boost | 7.3x | `728.7% / 100 = 7.3` |

### Section "Key Insight"

| Metric | Value | Công thức |
|--------|-------|-----------|
| Output tăng | 8.3x | `895 / 108 = 8.29 ≈ 8.3` |
| Cost savings | $15,740 | `787 PRs × 2h × $10/hr` |
| PRs tăng thêm | 787 | `895 - 108` |

### Source Code tính toán

| Metric | File | Function/Line |
|--------|------|---------------|
| PR stats | `src/services/github.js` | `calculatePRStats()` line 111-176 |
| Sprint stats | `src/services/jira.js` | `calculateSprintStats()` line 159-193 |
| Sprint completion | `src/services/jira.js` | `calculateSprintMetrics()` line 87-115 |
| Cost savings | `src/components/SummarySection.jsx` | lines 14-18 |
| Productivity boost | `src/components/SummarySection.jsx` | line 230 |

---

## 4. Cost Savings Calculation (Chi phí tiết kiệm)

### 3.1 Công thức chi tiết

```
Số PRs tăng thêm = PRs After - PRs Before
                 = 895 - 108
                 = 787 PRs

Estimated Hours Saved = Số PRs tăng thêm × Giờ tiết kiệm mỗi PR
                      = 787 × 2
                      = 1,574 hours

Work Days Saved = Hours Saved / 8 (giờ/ngày)
                = 1,574 / 8
                = 196.75 ≈ 197 days

Cost Savings = Hours Saved × Hourly Rate
             = 1,574 × $10
             = $15,740
```

### 3.2 Giả định (Assumptions)

| Parameter | Value | Giải thích |
|-----------|-------|------------|
| Hours Saved Per PR | 2 hours | Ước tính thời gian tiết kiệm cho mỗi PR nhờ AI assistance (viết code, review, fix bugs nhanh hơn) |
| Hourly Rate | $10/hr | Chi phí nhân lực trung bình per hour |
| Work Hours/Day | 8 hours | Ngày làm việc tiêu chuẩn |

**Lưu ý:**
- Cost savings được tính dựa trên **số PRs TĂNG THÊM** (787), không phải tổng PRs (895)
- Giả định 2h/PR là ước tính, có thể điều chỉnh tùy thực tế

---

## 5. Verification Checklist

### GitHub PRs
- [ ] Tổng PRs = 1,003 (584 + 419)
- [ ] PRs Before 01/07/2025 = 108 (64 + 44)
- [ ] PRs After 01/07/2025 = 895 (520 + 375)
- [ ] PR Increase = 787 (895 - 108)
- [ ] PR Volume Increase = 728.7%

### Cost Savings
- [ ] Hours Saved = 1,574 (787 × 2)
- [ ] Work Days = 197 (1,574 / 8)
- [ ] Cost Savings = $15,740 (1,574 × $10)

### Jira Sprints
- [ ] Verify board ID từ API
- [ ] Verify sprint list và endDates
- [ ] Verify story points per sprint

---

## 6. Source Code References

| File | Purpose |
|------|---------|
| `src/services/github.js` | GitHub API calls, PR fetching, stats calculation |
| `src/services/jira.js` | Jira API calls, sprint data fetching |
| `src/utils/calculations.js` | Metric calculations, formatting |
| `src/components/SummarySection.jsx` | UI display, cost savings formula |
| `src/App.jsx` | Main app, HOURLY_RATE constant ($10) |
| `server.js` | Proxy server - forward requests to GitHub/Jira APIs |

---

## 7. Quick Verification Commands (Copy-Paste)

```bash
# 1. Kiểm tra server đang chạy
curl -s "http://localhost:3004/api/health" | jq

# 2. Đếm tổng PRs lumilink-be (chạy 1 dòng)
total=0; for i in {1..10}; do c=$(curl -s "http://localhost:3004/api/github/repos/DefikitTeam/lumilink-be/pulls?state=all&per_page=100&page=$i" | jq 'length'); [ "$c" -eq 0 ] && break; total=$((total+c)); done; echo "lumilink-be: $total PRs"

# 3. Đếm tổng PRs lumilink-fe (chạy 1 dòng)
total=0; for i in {1..10}; do c=$(curl -s "http://localhost:3004/api/github/repos/DefikitTeam/lumilink-fe/pulls?state=all&per_page=100&page=$i" | jq 'length'); [ "$c" -eq 0 ] && break; total=$((total+c)); done; echo "lumilink-fe: $total PRs"

# 4. Xem sample PR data
curl -s "http://localhost:3004/api/github/repos/DefikitTeam/lumilink-be/pulls?state=all&per_page=1" | jq '.[0] | {number, title, created_at, merged_at}'
```

---

*Document created: 2026-02-03*
*Dashboard version: 0.0.0*
