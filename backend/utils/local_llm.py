"""
Local LLM helper - tiny on-CPU model (Qwen2.5-1.5B-Instruct, GGUF Q4_K_M)
used ONLY to phrase natural-language answers for the AI Chat assistant.

Design constraints (server is RAM-tight, shared with production services):
- Lazy-loaded: nothing is loaded into memory until the first real call.
- Auto-unloaded after IDLE_UNLOAD_SECONDS of no use, so the ~1.8GB
  footprint isn't paid permanently - only while the chat is actively used.
- Never used to look up or compute ERP data itself. Callers pass already
  DB-verified facts in the prompt; the model only rephrases them. This
  keeps numbers/permissions accurate regardless of what the model does.
  Real ERP data questions are still answered exclusively by the 36
  DB-backed intent handlers in ai_assistant.py, RBAC-checked, never by
  this model - it only ever handles the conversational fallback.
"""
import os
import threading
import time

MODEL_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    'ml_models', 'local_llm', 'qwen2.5-1.5b-instruct-q4_k_m.gguf'
)
IDLE_UNLOAD_SECONDS = 300

_lock = threading.Lock()
_llm = None
_last_used = 0.0
_watchdog_started = False


def _unload_watchdog():
    global _llm
    while True:
        time.sleep(30)
        with _lock:
            if _llm is not None and (time.time() - _last_used) > IDLE_UNLOAD_SECONDS:
                _llm = None
                print("[local_llm] idle timeout - model unloaded, RAM freed")


def _ensure_loaded():
    global _llm, _watchdog_started
    if not _watchdog_started:
        threading.Thread(target=_unload_watchdog, daemon=True).start()
        _watchdog_started = True

    if _llm is None:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(f"Local LLM model not found at {MODEL_PATH}")
        from llama_cpp import Llama
        print("[local_llm] loading model into memory...")
        _llm = Llama(
            model_path=MODEL_PATH,
            n_ctx=2048,
            n_threads=2,
            verbose=False,
        )
    return _llm


def is_available():
    return os.path.exists(MODEL_PATH)


def generate_reply(system_prompt: str, user_message: str, max_tokens: int = 200) -> str:
    """Ask the local model for a short natural-language reply. Raises on
    failure - callers should catch and fall back to the canned responses
    that already exist, so a model hiccup never breaks the chat."""
    global _last_used
    with _lock:
        llm = _ensure_loaded()
        _last_used = time.time()
        result = llm.create_chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            max_tokens=max_tokens,
            temperature=0.6,
        )
        _last_used = time.time()
        return result['choices'][0]['message']['content'].strip()
