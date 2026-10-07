import json
import httpx
import re
import sys
from typing import Dict, Any, Optional
from .config import (
    DEFAULT_PROVIDER,
    OLLAMA_BASE_URL,
    DEFAULT_OLLAMA_MODEL,
    OPENAI_API_KEY,
    OPENAI_MODEL,
    GEMINI_API_KEY,
    GEMINI_MODEL,
    GROQ_API_KEY,
    GROQ_MODEL,
)

class LLMClient:
    """Multi-provider client supporting Ollama, OpenAI, Gemini, Groq with smart fallback."""

    def __init__(
        self,
        provider: str = DEFAULT_PROVIDER,
        model_name: Optional[str] = None,
        ollama_url: Optional[str] = None,
        api_key: Optional[str] = None,
    ):
        self.provider = (provider or DEFAULT_PROVIDER).lower()
        self.ollama_url = (ollama_url or OLLAMA_BASE_URL).rstrip("/")
        self.api_key = api_key
        
        if self.provider == "ollama":
            self.model_name = model_name or DEFAULT_OLLAMA_MODEL
        elif self.provider == "openai":
            self.model_name = model_name or OPENAI_MODEL
            self.api_key = self.api_key or OPENAI_API_KEY
        elif self.provider == "gemini":
            self.model_name = model_name or GEMINI_MODEL
            self.api_key = self.api_key or GEMINI_API_KEY
        elif self.provider == "groq":
            self.model_name = model_name or GROQ_MODEL
            self.api_key = self.api_key or GROQ_API_KEY
        else:
            self.model_name = model_name or "llama3"

    async def check_health(self) -> Dict[str, Any]:
        """Check connection to the chosen provider."""
        if self.provider == "ollama":
            try:
                async with httpx.AsyncClient(timeout=3.0) as client:
                    resp = await client.get(f"{self.ollama_url}/api/tags")
                    if resp.status_code == 200:
                        models = [m.get("name") for m in resp.json().get("models", [])]
                        return {
                            "status": "connected",
                            "provider": "ollama",
                            "url": self.ollama_url,
                            "models": models,
                            "active_model": self.model_name
                        }
            except Exception as e:
                return {
                    "status": "unreachable",
                    "provider": "ollama",
                    "error": str(e),
                    "hint": "Make sure Ollama is running (`ollama serve` or open Ollama app)"
                }
        elif self.provider in ["openai", "groq", "gemini"]:
            return {
                "status": "configured" if self.api_key else "missing_key",
                "provider": self.provider,
                "active_model": self.model_name
            }
        return {"status": "unknown", "provider": self.provider}

    async def generate(self, prompt: str, system_prompt: str = "") -> str:
        """Generate a response from the selected LLM provider."""
        if self.provider == "ollama":
            return await self._call_ollama(prompt, system_prompt)
        elif self.provider == "openai":
            return await self._call_openai_compatible(
                "https://api.openai.com/v1/chat/completions",
                self.api_key,
                prompt,
                system_prompt
            )
        elif self.provider == "groq":
            return await self._call_openai_compatible(
                "https://api.groq.com/openai/v1/chat/completions",
                self.api_key,
                prompt,
                system_prompt
            )
        elif self.provider == "gemini":
            return await self._call_gemini(prompt, system_prompt)
        else:
            # Fallback to Ollama
            return await self._call_ollama(prompt, system_prompt)

    async def _call_ollama(self, prompt: str, system_prompt: str = "") -> str:
        url = f"{self.ollama_url}/api/generate"
        payload = {
            "model": self.model_name,
            "prompt": prompt,
            "system": system_prompt,
            "stream": True,
            "options": {
                "temperature": 0.1,
                "top_p": 0.9,
            }
        }
        print(f"   🌐 [STREAMING FROM OLLAMA] -> (Model: {self.model_name})", flush=True)
        print("   " + "-"*50, flush=True)
        sys.stdout.write("   \033[93m")  # Yellow text for live tokens
        sys.stdout.flush()

        collected_text = []
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream("POST", url, json=payload) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        if not line:
                            continue
                        try:
                            chunk = json.loads(line)
                            token = chunk.get("response", "")
                            if token:
                                sys.stdout.write(token)
                                sys.stdout.flush()
                                collected_text.append(token)
                            if chunk.get("done", False):
                                break
                        except json.JSONDecodeError:
                            continue
            
            sys.stdout.write("\033[0m\n")  # Reset terminal color
            print("   " + "-"*50, flush=True)
            full_text = "".join(collected_text)
            return full_text
        except httpx.ConnectError:
            sys.stdout.write("\033[0m\n")
            print(f"   ❌ [OLLAMA ERROR] Connection refused at {self.ollama_url}. Is Ollama running?", flush=True)
            raise ConnectionError(
                f"Could not connect to Ollama at {self.ollama_url}. "
                f"Please make sure Ollama is running locally (`ollama run {self.model_name}`)."
            )
        except Exception as e:
            sys.stdout.write("\033[0m\n")
            print(f"   ❌ [OLLAMA ERROR] {str(e)}", flush=True)
            raise RuntimeError(f"Ollama generation failed: {str(e)}")

    async def _call_openai_compatible(
        self, endpoint: str, api_key: str, prompt: str, system_prompt: str = ""
    ) -> str:
        if not api_key:
            raise ValueError(f"API key missing for {self.provider}")
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model_name,
            "messages": messages,
            "temperature": 0.1,
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(endpoint, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    async def _call_gemini(self, prompt: str, system_prompt: str = "") -> str:
        if not self.api_key:
            raise ValueError("Gemini API key is required")
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model_name}:generateContent?key={self.api_key}"
        
        full_text = f"{system_prompt}\n\nUser Request: {prompt}" if system_prompt else prompt
        payload = {
            "contents": [{"parts": [{"text": full_text}]}],
            "generationConfig": {"temperature": 0.1}
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]
