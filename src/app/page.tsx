"use client";

import {
  Box,
  Button,
  Stack,
  TextField,
  Typography,
  AppBar,
  Toolbar,
  IconButton,
  CircularProgress,
  Grid,
  useMediaQuery,
} from "@mui/material";
import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import DOMPurify from "isomorphic-dompurify";
import MenuIcon from "@mui/icons-material/Menu";
import SendIcon from "@mui/icons-material/Send";
import { useRouter } from "next/navigation";

type Message = {
  role: "assistant" | "user";
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi ! I'm the PopData support assistant. How can I help you today?",
    },
  ]);

  const [message, setMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [username, setUsername] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const isSmallScreen = useMediaQuery("(max-width: 600px)");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUsername = localStorage.getItem("username");
      if (!storedUsername) {
        router.push("/login"); // Redirect to login if user is not logged in
      } else {
        setUsername(storedUsername);
      }
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    localStorage;
  }, []);

  const sendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return;
    setIsLoading(true);
    setMessage("");
    setMessages((prevMessages) => [
      ...prevMessages,
      { role: "user", content: message },
      { role: "assistant", content: "" },
    ]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify([...messages, { role: "user", content: message }]),
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("Failed to get response reader");
      }

      let result = "";

      const processText = async ({
        done,
        value,
      }: ReadableStreamReadResult<Uint8Array>): Promise<string> => {
        if (done) {
          return result;
        }

        const text = decoder.decode(value || new Uint8Array(), {
          stream: true,
        });
        result += text;

        setMessages((prevMessages) => {
          const lastMessage = prevMessages[prevMessages.length - 1];
          const otherMessages = prevMessages.slice(0, -1);
          return [
            ...otherMessages,
            { ...lastMessage, content: lastMessage.content + text },
          ];
        });

        const next = await reader.read();
        return processText(next);
      };
      await reader.read().then(processText);
    } catch (error) {
      console.error("Error:", error);
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          role: "assistant",
          content:
            "I'm sorry, but I encountered an error. Please try again later.",
        },
      ]);
    }
    setIsLoading(false);
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage(message);
    }
  };

  const sanitizeMarkdown = (markdown: string) => {
    return DOMPurify.sanitize(markdown);
  };

  return (
    <Box
      width="100vw"
      height="100vh"
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
    >
      <AppBar position="static">
        <Toolbar>
          <Typography
            variant="h6"
            component="div"
            sx={{
              flexGrow: 1,
              fontSize: {
                xs: "1rem", // Font size for extra-small screens
                sm: "1.25rem", // Font size for small screens
                md: "1.5rem", // Font size for medium screens and above
              },
            }}
          >
            PopData Virtual Assistant
          </Typography>

          {username && (
            <Typography
              variant="body1"
              component="div"
              sx={{
                fontSize: {
                  xs: "0.8rem", // Font size for extra-small screens
                  sm: "1rem", // Font size for small screens
                  md: "1.25rem", // Font size for medium screens and above
                },
              }}
            >
              Welcome, {username}!
            </Typography>
          )}
        </Toolbar>
      </AppBar>

      <Stack
        direction={isSmallScreen ? "column" : "row"}
        width="90%"
        height="80%"
        spacing={2}
        justifyContent="center"
        alignItems="center"
        mt={2}
      >
        {/* First Stack: Chat Interface */}
        <Stack
          direction={"column"}
          width={isSmallScreen ? "100%" : "50%"}
          height="100%"
          border="1px solid"
          borderColor="primary.main"
          p={2}
          spacing={3}
          bgcolor="background.paper"
          boxShadow={3}
          borderRadius={2}
          overflow="hidden"
        >
          <Stack
            direction={"column"}
            spacing={2}
            flexGrow={1}
            overflow="auto"
            maxHeight="100%"
          >
            {messages.map((message, index) => (
              <Box
                key={index}
                display="flex"
                flexDirection="column"
                alignItems={
                  message.role === "assistant" ? "flex-start" : "flex-end"
                }
              >
                <Typography variant="caption" color="textSecondary">
                  {message.role === "assistant" ? "AI Assistant" : "User"}
                </Typography>
                <Box
                  bgcolor={
                    message.role === "assistant" ? "primary.main" : "grey.500"
                  }
                  color="white"
                  borderRadius={2}
                  p={2}
                  maxWidth="75%"
                >
                  <ReactMarkdown>
                    {sanitizeMarkdown(message.content)}
                  </ReactMarkdown>
                </Box>
              </Box>
            ))}
            <div ref={messagesEndRef} />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Message"
              fullWidth
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={isLoading}
            />
            <Button
              variant="contained"
              onClick={() => sendMessage(message)}
              disabled={isLoading}
              startIcon={
                isLoading ? <CircularProgress size={16} /> : <SendIcon />
              }
              sx={{
                transition: "transform 0.3s, box-shadow 0.3s",
                "&:hover": {
                  transform: "scale(1.1)",
                  boxShadow: "0 0 10px rgba(33, 150, 243, 0.5)",
                },
              }}
            >
              {isLoading ? "Sending..." : "Send"}
            </Button>
          </Stack>
        </Stack>

        {/* Second Stack: Additional Content */}
        <Stack
          direction={"column"}
          width={isSmallScreen ? "100%" : "50%"}
          height="100%"
          p={2}
          spacing={2}
          bgcolor="background.paper"
          boxShadow={3}
          borderRadius={2}
        >
          {/* Upper Half: Sample Queries */}
          <Box
            flexGrow={1}
            border="1px solid"
            borderColor="primary.main"
            p={2}
            borderRadius={2}
            overflow="auto"
          >
            <Typography variant="h6" gutterBottom>
              Sample Queries:
            </Typography>
            <Typography variant="body1">
              - What is the current world population?
            </Typography>
            <Typography variant="body1">
              - Show me population growth trends for the last decade.
            </Typography>
            <Typography variant="body1">
              - How does the population density vary across continents?
            </Typography>
            <Typography variant="body1">
              - What are the top 10 most populous countries?
            </Typography>
          </Box>

          {/* Lower Half: Description */}
          <Box
            flexGrow={1}
            border="1px solid"
            borderColor="primary.main"
            p={2}
            borderRadius={2}
            overflow="auto"
          >
            <Typography variant="h6" gutterBottom>
              Description:
            </Typography>
            <Typography variant="body1">
              The current world population is constantly changing and is
              estimated to be over 8 billion as of 2024. Understanding
              population dynamics is crucial for planning and policy-making.
              Explore more about the world&apos;s population statistics, trends,
              and projections here.
            </Typography>
          </Box>
        </Stack>
      </Stack>
    </Box>
  );
}
