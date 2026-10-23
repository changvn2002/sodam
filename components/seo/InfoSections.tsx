import { FAQS } from '@/lib/faq';

/**
 * Nội dung chữ tĩnh ở cuối trang chủ — phần để công cụ tìm kiếm (và người
 * lần đầu ghé) đọc hiểu Sổ Đám làm gì, trước khi họ mở sổ dùng thử. Toàn bộ
 * là nội dung thật về app bản không tài khoản: giới thiệu, cách dùng, các
 * loại đám ghi được, cơ chế mã mời, và FAQ (dùng chung dữ liệu với FAQPage
 * JSON-LD trong app/page.tsx). Component này render phía server nên nội
 * dung có mặt ngay trong HTML trả về, không phụ thuộc JavaScript phía
 * người dùng.
 */
const EVENT_KINDS: ReadonlyArray<string> = [
  'Đám cưới',
  'Đám hỏi',
  'Đám tang',
  'Đám giỗ',
  'Mừng thọ',
  'Thôi nôi',
  'Đầy tháng',
  'Tân gia',
  'Khai trương',
  'Sinh nhật',
  'Mừng tuổi / lì xì',
  'Tốt nghiệp',
];

export default function InfoSections() {
  return (
    <div className="border-t border-line bg-paper text-ink">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
        <section aria-labelledby="gioi-thieu">
          <h2 id="gioi-thieu" className="font-display text-2xl font-bold tracking-tight">
            Sổ ghi lễ cho mọi đám trong nhà
          </h2>
          <p className="mt-3 max-w-3xl leading-relaxed text-muted">
            Nhà có đám là có cả trăm phong bì: ai mừng bao nhiêu, mừng ở đám nào, rồi đến lượt nhà
            mình phải trả lễ ai, trả bao nhiêu cho phải phép. Sổ giấy ghi tay thì dễ thất lạc, cộng
            tổng mệt, đến ngày cần đối chiếu lại không nhớ nổi. Sổ Đám đưa cuốn sổ đó lên điện
            thoại: ghi lại từng khoản lễ, tự cộng tổng theo từng sự kiện, và giữ danh sách nghĩa vụ
            trả lễ để bạn không sót một ai.
          </p>
          <p className="mt-3 max-w-3xl leading-relaxed text-muted">
            App không bắt đăng ký tài khoản. Mở app, tạo sổ, nhận mã mời — cả nhà dùng chung mã đó
            là cùng viết vào một cuốn sổ, như chuyền tay nhau cuốn sổ dưới quê, chỉ khác là không
            bao giờ mất trang.
          </p>
        </section>

        <section aria-labelledby="cach-dung" className="mt-12">
          <h2 id="cach-dung" className="font-display text-2xl font-bold tracking-tight">
            Cách dùng Sổ Đám trong 4 bước
          </h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <li className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)]">
              <p className="font-semibold">1. Tạo sổ, nhận mã mời</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                Mở app và tạo cuốn sổ đầu tiên — không cần tài khoản hay mật khẩu. Mỗi sổ có một mã
                mời riêng gồm 12 ký tự.
              </p>
            </li>
            <li className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)]">
              <p className="font-semibold">2. Chia sẻ cho cả nhà</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                Gửi mã mời hoặc đường link chia sẻ cho người thân. Ai mở link là vào thẳng cuốn sổ
                và ghi cùng; nhập sai mã thì không thấy sổ.
              </p>
            </li>
            <li className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)]">
              <p className="font-semibold">3. Ghi lễ: gõ, nói hoặc chụp ảnh</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                Ghi từng khoản bằng tay, đọc bằng giọng nói để app tự tách tên và số tiền, hoặc chụp
                ảnh trang sổ tay cho AI trích xuất. Ngày âm lịch hiển thị kèm theo từng sự kiện.
              </p>
            </li>
            <li className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)]">
              <p className="font-semibold">4. Theo dõi trả lễ và tổng kết</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                App tự ghi nhận nghĩa vụ trả lễ khi khách mừng ở đám nhà bạn tổ chức. Xem tổng đã
                nhận, đã trả, còn chờ và đưa quá tay theo từng sự kiện, xuất ra CSV khi cần lưu trữ.
              </p>
            </li>
          </ol>
        </section>

        <section aria-labelledby="cac-loai-dam" className="mt-12">
          <h2 id="cac-loai-dam" className="font-display text-2xl font-bold tracking-tight">
            Ghi được cho những dịp nào?
          </h2>
          <p className="mt-3 max-w-3xl leading-relaxed text-muted">
            Sổ Đám có sẵn các loại sự kiện theo đúng phong tục Việt, cho cả đám nhà bạn tổ chức lẫn
            đám bạn đi dự:
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {EVENT_KINDS.map((kind) => (
              <li
                key={kind}
                className="rounded-full border border-line bg-card px-3.5 py-1.5 text-sm font-medium"
              >
                {kind}
              </li>
            ))}
            <li className="rounded-full border border-line bg-card px-3.5 py-1.5 text-sm font-medium">
              Và các dịp khác
            </li>
          </ul>
        </section>

        <section aria-labelledby="ma-moi" className="mt-12">
          <h2 id="ma-moi" className="font-display text-2xl font-bold tracking-tight">
            Không tài khoản — mã mời là chìa khóa
          </h2>
          <p className="mt-3 max-w-3xl leading-relaxed text-muted">
            Sổ Đám bỏ hẳn tài khoản và mật khẩu để người lớn tuổi trong nhà cũng mở lên là dùng
            được. Thay vào đó, mỗi cuốn sổ có một mã mời riêng: đúng mã mới vào được sổ, sai mã thì
            app trả lời như cuốn sổ không tồn tại. Đổi lại, ai giữ mã cũng đọc và ghi được vào sổ —
            nên hãy giữ mã mời như giữ chìa khóa nhà: chỉ gửi cho người thân qua kênh riêng, đừng
            đăng nơi công khai.
          </p>
        </section>

        <section aria-labelledby="faq" className="mt-12">
          <h2 id="faq" className="font-display text-2xl font-bold tracking-tight">
            Câu hỏi thường gặp
          </h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {FAQS.map((faq) => (
              <article
                key={faq.question}
                className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)]"
              >
                <h3 className="font-semibold">{faq.question}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{faq.answer}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
