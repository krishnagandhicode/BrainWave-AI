import { useEffect, useRef, useState } from "react";
import "./newPrompt.css";
import Upload from "../upload/Upload";
import { IKImage } from "imagekitio-react";
import Markdown from "react-markdown";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import { buildApiUrl, getResponseError } from "../../lib/api";

const getUsableChatId = (value) => {
  const parsed = typeof value === "string" ? value.trim() : "";

  if (!parsed || parsed === "undefined" || parsed === "null" || parsed === "new") {
    return "";
  }

  // Basic validation for Mongo ObjectID (24 hex chars)
  if (!/^[0-9a-fA-F]{24}$/.test(parsed)) {
    return "";
  }

  return parsed;
};

const getReadableAiError = (error) => {
  const message = error?.message || "";

  if (/quota|429|rate\s*limit/i.test(message)) {
    return "Gemini quota is currently exhausted for this API project. Update billing/quota in Google AI Studio or switch to a project key with available quota.";
  }

  if (/api key|permission|403|401|unauthor/i.test(message)) {
    return "Gemini API key is invalid or lacks permission for this project/model. Check backend GEMINI_API_KEY and project access.";
  }

  return message || "Something went wrong. Please try again.";
};

const NewPrompt = ({ chatId }) => {
  const usableChatId = getUsableChatId(chatId);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const { getToken, userId } = useAuth();

  const [img, setImg] = useState({
    isLoading: false,
    error: "",
    dbData: {},
    aiData: {},
  });

  const endRef = useRef(null);

  useEffect(() => {
    setQuestion("");
    setAnswer("");
    setErrorMessage("");
    setImg({ isLoading: false, error: "", dbData: {}, aiData: {} });
  }, [usableChatId]);

  const add = async (text) => {
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      setQuestion(text);

      const token = (await getToken({ skipCache: true })) || (await getToken());
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
        body: JSON.stringify({
          prompt: text,
          image: Object.entries(img.aiData).length ? img.aiData : null,
        }),
      });

      if (!generateResponse.ok) {
        const message = await getResponseError(
          generateResponse,
          "Failed to generate response"
        );
        throw new Error(message);
      }

      const generation = await generateResponse.json();
      const accumulatedText = generation?.text || "";
      setAnswer(accumulatedText);

      if (usableChatId) {
        const response = await fetch(
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
              question: text,
              answer: accumulatedText,
              img: img.dbData?.filePath,
            }),
          }
        );

        if (!response.ok) {
          const message = await getResponseError(
            response,
            "Failed to save chat response"
          );
          throw new Error(message || "Failed to save chat response");
        }

        queryClient.invalidateQueries({ queryKey: ["chat", usableChatId] });
        queryClient.invalidateQueries({ queryKey: ["userChats"] });

        // Once saved, let server history be the source of truth for rendering.
        setQuestion("");
        setAnswer("");
      }

      setImg({ isLoading: false, error: "", dbData: {}, aiData: {} });
    } catch (error) {
      setErrorMessage(getReadableAiError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const text = e.target.text.value;
    if (!text || isSubmitting) return;

    add(text);
    e.target.reset();
  };

  return (
    <>
      {/* {ADD NEW CHAT} */}
      {img.isLoading && <div className="">Loading...</div>}
      {img.dbData?.filePath && (
        <IKImage
          urlEndpoint={import.meta.env.VITE_IMAGE_KIT_ENDPOINT}
          path={img.dbData?.filePath}
          width="380"
          transformation={[{ width: 380 }]}
        />
      )}
      {question && <div className="message user">{question}</div>}
      {answer && (
        <div className="message">
          <Markdown>{answer}</Markdown>
        </div>
      )}
      {errorMessage && <div className="message">{errorMessage}</div>}

      <div className="endChat" ref={endRef}></div>

      <form autoComplete="off" className="newForm" onSubmit={handleSubmit}>
        <Upload setImg={setImg} />
        <input id="file" type="file" multiple={false} hidden />
        <input type="text" name="text" placeholder="Ask Anything..." />
        <button disabled={isSubmitting}>
          <img src="/arrow.png" alt="" />
        </button>
      </form>
    </>
  );
};

export default NewPrompt;
