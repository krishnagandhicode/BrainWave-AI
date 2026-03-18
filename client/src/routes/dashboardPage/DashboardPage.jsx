import { useMutation, useQueryClient } from "@tanstack/react-query";
import "./dashboardPage.css";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { buildApiUrl, getResponseError } from "../../lib/api";

const toChatId = (payload) => {
  if (typeof payload === "string" && payload.trim()) {
    return payload.trim();
  }

  const direct =
    payload?.id ||
    payload?._id ||
    payload?.chatId ||
    payload?.data?.id ||
    payload?.data?._id ||
    payload?.data?.chatId;

  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }

  if (direct && typeof direct === "object") {
    if (typeof direct.$oid === "string" && direct.$oid.trim()) {
      return direct.$oid.trim();
    }

    if (typeof direct.toString === "function") {
      const converted = direct.toString();
      if (converted && converted !== "[object Object]") {
        return converted;
      }
    }
  }

  return "";
};

const resolveCreatedChatId = async ({ token, text, userId }) => {
  const response = await fetch(buildApiUrl("/api/userchats"), {
    credentials: "include",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(userId ? { "x-user-id": userId } : {}),
    },
  });

  if (!response.ok) {
    return "";
  }

  const list = await response.json().catch(() => []);
  const chats = Array.isArray(list) ? list : [];
  const normalizedTitle = text.trim().slice(0, 40);

  // Prefer the most recently inserted matching title.
  const matching = chats
    .slice()
    .reverse()
    .find((chat) => (chat?.title || "") === normalizedTitle);

  return toChatId(matching);
};

const DashboardPage = () => {

  const queryClient = useQueryClient();
  const { getToken, userId } = useAuth();

  const navigate = useNavigate();


  const mutation = useMutation({
    mutationFn: async (text) => {
      const token = (await getToken({ skipCache: true })) || (await getToken());
      if (!token) {
        throw new Error("Authentication token is not ready");
      }

      const url = buildApiUrl("/api/chats");

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(userId ? { "x-user-id": userId } : {}),
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const message = await getResponseError(response, "Unable to create chat");
        throw new Error(message || "Unable to create chat");
      }

      const payload = await response.json();
      let chatId = toChatId(payload);

      if (!chatId) {
        chatId = await resolveCreatedChatId({ token, text, userId });
      }

      if (!chatId) {
        throw new Error("Unable to resolve the new chat id from server response");
      }

      return { chatId };
    },
    onSuccess: ({ chatId }) => {
      // Invalidate and refresh
      queryClient.invalidateQueries({ queryKey: ["userChats"] });
      navigate(`/dashboard/chats/${encodeURIComponent(chatId)}`);
    },
    onError: (error) => {
      console.error(error);
    },
  });


  const handleSubmit = async (e) => {
    e.preventDefault();
    const text = e.target.text.value;
    if (!text || mutation.isPending) return;

    mutation.mutate(text);
  };

  return (
    <div className="dashboardPage">
      <div className="texts">
        <div className="logo">
          <img src="/wave1.ai.png" alt="" />
          <h1>BrainWave</h1>
        </div>
        <div className="options">
          <div className="option">
            <img src="/chat.png" alt="" />
            <Link to="/dashboard">Create a New</Link> Chat
          </div>
          <div className="option">
            <img src="/image.png" alt="" />
            <span>Analyze Image</span>
          </div>
          <div className="option">
            <img src="/code.png" alt="" />
            <span>Help me with my code</span>
          </div>
        </div>
      </div>
      <div className="formContainer">
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            autoComplete="off"
            name="text"
            placeholder="Ask me anything..."
            disabled={mutation.isPending}
          />
          <button disabled={mutation.isPending}>
            <img src="/arrow.png" alt="" />
          </button>
        </form>
        {mutation.isError && (
          <div style={{ marginTop: "8px", color: "#f87171" }}>
            {mutation.error?.message || "Unable to create chat right now."}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
