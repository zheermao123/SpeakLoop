# SpeakLoop

æµè§ˆå™¨é‡Œçš„ AI è‹±è¯­å£è¯­ç§æ•™ï¼šèŒåœºåœºæ™¯è¯­éŸ³å¯¹è¯ + ç»ƒåçº é”™æŠ¥å‘Š + ç”Ÿè¯é—­ç¯ã€‚

## å¿«é€Ÿå¼€å§‹ï¼ˆMock æ¨¡å¼ï¼Œæ— éœ€ GPU/Keyï¼‰

```powershell
npm install
npm run dev
```

æ‰“å¼€ http://localhost:3000

## çœŸå®è¯­éŸ³ + çœŸå® Chat

1. éƒ¨ç½² ai-server åŒæœåŠ¡ï¼ˆ`docs/superpowers/plans/2026-10-01-speakloop-phase0-ai-server.md`ï¼‰ï¼Œ`scripts/start-ai.ps1` ä¸€é”®æ‹‰èµ·ï¼ˆasr :8100 / tts :8101ï¼Œå†·è½½çº¦ 2-3 åˆ†é’Ÿï¼‰
2. `.env` è®¾ç½®ï¼š`STT_PROVIDER=qwen3-local`ã€`TTS_PROVIDER=qwen3-local`
3. çœŸå® Chatï¼ˆå¯é€‰ï¼‰ï¼š`CHAT_PROVIDER=openai-compatible` + `CHAT_BASE_URL`/`CHAT_API_KEY`/`CHAT_MODEL`ï¼ˆä»»æ„ OpenAI å…¼å®¹å‚å•†ï¼‰
4. `npm run doctor` è‡ªæ£€ â†’ æ‰“å¼€é¦–é¡µï¼ˆè‡ªåŠ¨åŒé¢„çƒ­ï¼‰

## ç¯å¢ƒå˜é‡

è§ `.env.example`ã€‚è®¾è®¡æ–‡æ¡£ï¼š`docs/superpowers/specs/2026-10-01-speakloop-design.md`

## Ò»¼üÆô¶¯£¨ÍÆ¼ö£©

Ë«»÷¸ùÄ¿Â¼ `Æô¶¯SpeakLoop.vbs`£ºÎŞ´°¿ÚÀ­Æğ ai-server Ë«·şÎñ + Next.js£¬¾ÍĞ÷ºó×Ô¶¯´ò¿ªä¯ÀÀÆ÷£¨ÓïÒôÔ¤ÈÈÔ¼ 2-3 ·ÖÖÓ£©¡£`Í£Ö¹SpeakLoop.vbs` Ò»¼üÍ£Ö¹¡£ÈÕÖ¾¼û `logs/`¡£
