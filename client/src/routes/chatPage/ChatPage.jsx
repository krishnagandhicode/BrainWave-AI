import "./chatPage.css";
import NewPrompt from "../../components/newPrompt/NewPrompt";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import Markdown from "react-markdown";
import { IKImage } from "imagekitio-react";
import { useAuth } from "@clerk/clerk-react";
import { buildApiUrl, getResponseError } from "../../lib/api";

const getUsableChatId = (value) => {
  const parsed = typeof value === "string" ? value.trim() : "";

  if (!parsed || parsed === "undefined" || parsed === "null" || parsed === "new") {
    return "";
  }

  if (!/^[0-9a-fA-F]{24}$/.test(parsed)) {
    return "";
  }

  return parsed;
};

const Chatpage = () => {
  const { id: chatId } = useParams();
  const usableChatId = getUsableChatId(chatId);
  const hasValidChatId = Boolean(usableChatId);
  const queryClient = useQueryClient();
  const { getToken, isLoaded, userId } = useAuth();
  const [isBootstrappingFirstReply, setIsBootstrappingFirstReply] = useState(false);
  const bootstrappedChatIdRef = useRef("");

  const { isPending, error, data } = useQuery({
    queryKey: ["chat", usableChatId],
    enabled: isLoaded && !!userId && hasValidChatId,
    retry: false,
    queryFn: async () => {
      const token = (await getToken({ skipCache: true })) || (await getToken());
      if (!token) {
        throw new Error("Authentication token is not ready");
      }

      const response = await fetch(
        buildApiUrl(`/api/chats/${encodeURIComponent(usableChatId)}`),
        {
        credentials: "include",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(userId ? { "x-user-id": userId } : {}),
        },
      }
      );

      if (!response.ok) {
        const message = await getResponseError(response, "Failed to fetch chat");
        throw new Error(message || "Failed to fetch chat");
      }

      return response.json();
    },
  });

  const titleFromHistory =
    data?.history?.find((item) => item?.role === "user")?.parts?.[0]?.text ||
    "New Chat";
  const chatTitle =
    titleFromHistory.length > 60
      ? `${titleFromHistory.slice(0, 57)}...`
      : titleFromHistory;

  useEffect(() => {
    bootstrappedChatIdRef.current = "";
  }, [usableChatId]);

  useEffect(() => {
    if (!hasValidChatId || !isLoaded || !userId || !data?.history?.length) {
      return;
    }

    const history = data.history;
    const firstUserPrompt = history[0]?.parts?.[0]?.text?.trim();
    const needsInitialReply =
      history.length === 1 && history[0]?.role === "user" && !!firstUserPrompt;

    if (!needsInitialReply) {
      return;
    }

    if (bootstrappedChatIdRef.current === usableChatId) {
      return;
    }

    bootstrappedChatIdRef.current = usableChatId;
    let cancelled = false;

    const bootstrapInitialReply = async () => {
      try {
        setIsBootstrappingFirstReply(true);
        const token =
          (await getToken({ skipCache: true })) || (await getToken());

        if (!token) {
          throw new Error("Authentication token is not ready");
        }

        const generateResponse = await fetch(buildApiUrl("/api/generate"), {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(userId ? { "x-user-id": userId } : {}),
          },
          body: JSON.stringify({ prompt: firstUserPrompt }),
        });

        if (!generateResponse.ok) {
          const message = await getResponseError(
            generateResponse,
            "Failed to generate first reply"
          );
          throw new Error(message || "Failed to generate first reply");
        }

        const generation = await generateResponse.json();
        const firstAnswer = generation?.text?.trim();

        if (!firstAnswer) {
          return;
        }

        const saveResponse = await fetch(
          buildApiUrl(`/api/chats/${encodeURIComponent(usableChatId)}`),
          {
            method: "PUT",
            credentials: "include",
            headers: {
              "Content-type": "application/json",
              Authorization: `Bearer ${token}`,
              ...(userId ? { "x-user-id": userId } : {}),
            },
            body: JSON.stringify({
              answer: firstAnswer,
              skipUser: true,
            }),
          }
        );

        if (!saveResponse.ok) {
          const message = await getResponseError(
            saveResponse,
            "Failed to save first reply"
          );
          throw new Error(message || "Failed to save first reply");
        }

        if (!cancelled) {
          queryClient.invalidateQueries({ queryKey: ["chat", usableChatId] });
          queryClient.invalidateQueries({ queryKey: ["userChats"] });
        }
      } catch (bootstrapError) {
        console.error("Initial chat bootstrap failed:", bootstrapError);
      } finally {
        if (!cancelled) {
          setIsBootstrappingFirstReply(false);
        }
      }
    };

    bootstrapInitialReply();

    return () => {
      cancelled = true;
    };
  }, [
    data,
    getToken,
    hasValidChatId,
    isLoaded,
    queryClient,
    usableChatId,
    userId,
  ]);

  return (
    <div className="chatpage">
      <div className="wrapper">
        <div className="chat">
          {hasValidChatId && (
            <div className="chatHeader">
              <h2>{chatTitle}</h2>
            </div>
          )}

          {!hasValidChatId
            ? (
              <div className="invalidChatMessage">
                This chat link is invalid. Please create a new chat from
                {" "}
                <Link to="/dashboard">Dashboard</Link>.
              </div>
            )
            : isPending
            ? "Loading..."
            : error
            ? error.message || "Something went wrong!"
            : data?.history?.map((message, i) => (
                <div
                  key={i}
                  className={`chatMessageRow ${
                    message.role === "user" ? "user" : "model"
                  }`}
                >
                  {message.img && (
                    <IKImage
                      urlEndpoint={import.meta.env.VITE_IMAGE_KIT_ENDPOINT}
                      path={message.img}
                      height="300"
                      width="400"
                      transformation={[{ height: 300, width: 400 }]}
                      loading="lazy"
                      lqip={{ active: true, quality: 20 }}
                    />
                  )}
                  <div
                    className={
                      message.role === "user" ? "message user" : "message"
                    }
                  >
                    <Markdown>{message.parts[0].text}</Markdown>
                  </div>
                </div>
              ))}

          {isBootstrappingFirstReply && (
            <div className="message">Generating first reply...</div>
          )}

          <NewPrompt chatId={usableChatId} />
        </div>
      </div>
    </div>
  );
};

export default Chatpage;
