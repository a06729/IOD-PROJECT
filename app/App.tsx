import Link from "next/link";
import { getServerSession } from "next-auth";
import {options} from "@/app/api/auth/[...nextauth]/options";

export default async function Page() {
  const session=await getServerSession(options);
  return (
    <main className="h-screen overflow-hidden">
      <p>main 페이지2</p>
      <Link href="/board">캔버스</Link>
      {session?(
        <Link href="/api/auth/signout?callbackUrl=/">로그아웃</Link>
      ):(<Link href="/api/auth/signin">로그인</Link>)}
    </main>
  );
}