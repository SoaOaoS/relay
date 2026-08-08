const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  "https://uazlfifipfztygfutraz.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhemxmaWZpcGZ6dHlnZnV0cmF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMDIzNjcsImV4cCI6MjEwMTU3ODM2N30.ENjKVevblAkCadEsMd82M4qHwSyino1Xt7_DPu0AXe8"
);

(async () => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "mav@relaywith.com",
    password: "MavTest2026!"
  });
  if (error) { console.log("ERROR:", error.message); return; }
  const token = data.session.access_token;
  const refresh = data.session.refresh_token;

  // Build the @supabase/ssr cookie format
  // The sb-<ref>-auth-token cookie stores the session as base64
  const sessionStr = JSON.stringify(["bearer", token, refresh, null, null, null, "session"]);
  const b64 = Buffer.from(sessionStr).toString('base64');
  const cookieName = "sb-uazlfifipfztygfutraz-auth-token";
  const cookie = cookieName + "=" + b64;

  console.log("Cookie:", cookie.slice(0, 80) + "...");

  const res = await fetch("http://localhost:3000/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": cookie,
    },
    body: JSON.stringify({
      message: "Book a table for 4 people tonight at 9pm at Gabby Irish Pub in Prague. My name is Raphael, email raphael.girard.iut@gmail.com, phone +33634554177.",
      stream: false,
    }),
  });
  const text = await res.text();
  console.log("STATUS:", res.status);
  try {
    const chatData = JSON.parse(text);
    console.log("RESPONSE:", (chatData.response || chatData.error || "").slice(0, 3000));
    if (chatData.toolCalls?.length) console.log("TOOL_CALLS:", JSON.stringify(chatData.toolCalls));
  } catch {
    console.log("RAW:", text.slice(0, 2000));
  }
})().catch(e => console.error(e));