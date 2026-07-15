import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F5F2EE]">
      <Header title="页面未找到" />
      <main className="flex flex-1 items-center justify-center px-4 py-20 text-center">
        <div>
          <p className="text-sm font-semibold tracking-[0.25em] text-[#675A4D]">404</p>
          <h1 className="mt-3 text-3xl font-bold text-[#3D3832]">这个页面不存在</h1>
          <p className="mt-3 text-sm text-[#625C54]">链接可能已失效，或地址输入有误。</p>
          <Link className="mt-7 inline-flex rounded-lg bg-[#7A6E5F] px-5 py-2.5 text-sm font-medium text-white" to="/">返回首页</Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
