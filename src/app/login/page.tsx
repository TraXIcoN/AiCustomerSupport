"use client";
console.log("Hey there!");
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, TextField, Typography, Stack } from "@mui/material";

export default function Login() {
  const [username, setUsername] = useState<string>("");
  const router = useRouter();

  const handleLogin = () => {
    if (username.trim()) {
      localStorage.setItem("username", username);
      router.push("/"); // Redirect to the main page after login
    }
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
      <Stack spacing={3} alignItems="center">
        <Typography variant="h4">Login</Typography>
        <TextField
          label="Enter your name"
          variant="outlined"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          fullWidth
        />
        <Button variant="contained" color="primary" onClick={handleLogin}>
          Login
        </Button>
      </Stack>
    </Box>
  );
}
