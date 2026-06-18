export default function Footer() {
  return (
    <footer
      style={{
        background: "linear-gradient(180deg, #F5F2EE 0%, #FAF8F5 100%)",
        padding: "24px 16px",
        textAlign: "center",
        borderTop: "1px solid #E8E4DE",
      }}
    >
      <p style={{ color: "#A8A095", fontSize: 13, margin: 0, letterSpacing: "0.02em" }}>
        专为 GCSE & IGCSE 学子精心打造
      </p>
      <div style={{ marginTop: 10, display: "flex", justifyContent: "center", gap: 16 }}>
        {["联系我们", "隐私声明", "免责声明"].map((text) => (
          <span
            key={text}
            style={{ color: "#B8B0A4", fontSize: 12, cursor: "pointer", transition: "color 0.3s ease" }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.color = "#8F7F6E"; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "#B8B0A4"; }}
          >
            {text}
          </span>
        ))}
      </div>
      <p style={{ color: "#C4BDB3", fontSize: 11, marginTop: 12 }}>
        数据来源：各考试局官方 | 仅供参考学习使用
      </p>
      <p style={{ color: "#C4BDB3", fontSize: 11, marginTop: 8 }}>
        Created by Leo Liu
      </p>
    </footer>
  );
}
