import { Link } from "react-router-dom";
import "./chatList.css";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import { buildApiUrl, getResponseError } from "../../lib/api";

const toChatId = (value) => {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (value && typeof value === "object") {
    const candidate = value._id || value.id || value.chatId;

    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }

    if (candidate && typeof candidate.toString === "function") {
      const converted = candidate.toString();
      if (converted && converted !== "[object Object]") {
        return converted;
      }
    }
  }

  return "";
};

const isValidChatId = (chatId) => /^[0-9a-fA-F]{24}$/.test(chatId);

const ChatList = () => {
  const { getToken, isLoaded, userId } = useAuth();

  const { isPending, error, data } = useQuery({
    queryKey: ["userChats"],
    enabled: isLoaded && !!userId,
    retry: false,
    queryFn: async () => {
      const token = (await getToken({ skipCache: true })) || (await getToken());
      if (!token) {
        throw new Error("Authentication token is not ready");
      }

      const response = await fetch(buildApiUrl("/api/userchats"), {
        credentials:"include",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(userId ? { "x-user-id": userId } : {}),
        },
      });

      if (!response.ok) {
        const message = await getResponseError(response, "Failed to fetch recent chats");
        throw new Error(message || "Failed to fetch recent chats");
      }

      return response.json();
    },
  });

  const chatItems = (Array.isArray(data)
    ? data
    : Array.isArray(data?.chats)
    ? data.chats
    : [])
    .map((chat) => ({ ...chat, __chatId: toChatId(chat) }))
    .filter((chat) => isValidChatId(chat.__chatId));

  return (
    <div className="chatList">
      <span className="title">DASHBOARD</span>
      <Link to="/dashboard">Create a new Chat</Link>
      <Link to="/">Explore BrainWave AI</Link>
      <Link to="/">Contact</Link>
      <hr />
      <span className="title">RECENT CHATS</span>
      <div className="list">
        {isPending
          ? "Loading..."
          : error
          ? error.message || "Something Went wrong"
          : chatItems.map((chat) => (
              <Link to={`/dashboard/chats/${encodeURIComponent(chat.__chatId)}`} key={chat.__chatId}>
                {chat.title}
              </Link>
            ))}
      </div>
      <hr />
      <div className="upgrade">
        <img src="/wave1.ai.png" alt="" />
        <div className="texts">
          <span>Upgarde to BrainWave Pro</span>
          <span>Get UnLimited access to all features</span>
        </div>
      </div>
    </div>
  );
};
export default ChatList;
