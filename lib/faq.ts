/**
 * Câu hỏi thường gặp về Sổ Đám — nguồn sự thật duy nhất cho cả section FAQ
 * hiển thị trên trang chủ (components/seo/InfoSections.tsx) và FAQPage
 * JSON-LD (app/page.tsx). Hai nơi PHẢI dùng chung dữ liệu này để structured
 * data khớp đúng nội dung người dùng nhìn thấy (yêu cầu của Google).
 *
 * Chỉ ghi những điều đúng với app thật, bản không tài khoản: mở sổ bằng mã
 * mời 16 ký tự, ghi lễ bằng tay hoặc giọng nói, nghĩa vụ trả lễ tự sinh,
 * tổng kết theo sự kiện, xuất/nhập CSV, và giới hạn offline được nói đúng
 * phần thật (hàng chờ chỉ cho ghi khoản mới — xem câu 6). Mỗi đáp án ≤55
 * từ, riêng câu offline ≤80 từ (COPY-DIET B5).
 */
export const FAQS: ReadonlyArray<{ question: string; answer: string }> = [
  {
    question: 'Sổ Đám là gì?',
    answer:
      'Sổ Đám là sổ ghi lễ cho đám cưới, đám hỏi, đám tang, đám giỗ, mừng thọ và nhiều dịp lễ khác của người Việt. App ghi ai đã mừng bao nhiêu, theo dõi lễ cần trả lại và tổng kết theo từng đám, thay cho sổ giấy dễ thất lạc, khó cộng tổng.',
  },
  {
    question: 'Sổ Đám có cần đăng ký tài khoản không? Mở một cuốn sổ như thế nào?',
    answer:
      'Không cần tài khoản, không có đăng nhập. Tạo sổ ngay khi mở app; mỗi sổ có mã mời gồm 16 ký tự do máy chủ tạo ngẫu nhiên. Chỉ ai có mã hoặc link chia sẻ chứa mã mới mở được sổ. Giữ mã như chìa khóa, chỉ chia sẻ trong gia đình.',
  },
  {
    question: 'Làm sao để ghi một khoản tiền mừng?',
    answer:
      'Có hai cách: gõ tay tên người mừng và số tiền, hoặc đọc bằng giọng nói: app nghe và tự tách tên cùng số tiền từ câu bạn đọc, ví dụ “anh Tuấn 500 nghìn”. Trước khi lưu, app hiện lại tên và số tiền để bạn kiểm tra và sửa nếu chưa đúng.',
  },
  {
    question: 'Phần trả lễ được theo dõi như thế nào?',
    answer:
      'Khi khách mừng ở đám do nhà bạn tổ chức, Sổ Đám tự ghi nhận khoản trả lễ tương ứng. Bạn đánh dấu đã trả hoặc bỏ qua từng khoản, đánh dấu nhầm thì hoàn tác được, và xem khoản nào còn chờ, khoản nào đã đưa quá tay trên bảng tổng kết của sổ.',
  },
  {
    question: 'Cả gia đình dùng chung một cuốn sổ được không?',
    answer:
      'Được. Đó là cách dùng chính của Sổ Đám. Bạn gửi mã mời hoặc bấm nút chia sẻ lấy link có sẵn mã; người thân mở link là vào thẳng sổ và ghi cùng. Mỗi thiết bị tự nhớ sổ đã mở trên máy đó, lần sau vào app là thấy lại.',
  },
  {
    question: 'Mất mạng thì có ghi lễ tiếp được không?',
    answer:
      'Được một phần, và app nói rõ phần nào: đang mở app mà mất mạng, bạn vẫn ghi tiếp khoản mới — khoản đó nằm trong hàng chờ trên máy này và tự gửi lên sổ khi có mạng lại. Mở sổ và xem dữ liệu cần có mạng, vì dữ liệu sổ nằm trên máy chủ. Hàng chờ chỉ áp dụng cho ghi khoản mới; sửa hoặc xóa khoản lúc mất mạng sẽ không được phát lại.',
  },
  {
    question: 'Dữ liệu của tôi nằm ở đâu, có lấy ra được không?',
    answer:
      'Dữ liệu sổ, sự kiện và các khoản lễ được lưu trên máy chủ của Sổ Đám. Bạn xuất sổ ra file CSV để lưu trữ, in giấy, và nhập lại khi cần. Sổ Đám còn có danh sách người kèm lịch sử mừng qua lại và cây họ từ các quan hệ bạn ghi.',
  },
];
