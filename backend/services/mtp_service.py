"""
MTP (Multi-Provider) сервис для работы с разными AI провайдерами
"""
import os
from typing import Optional
import openai
import anthropic
import google.generativeai as genai

from database.database import db

class MTPService:
    def __init__(self):
        self.openai_client = None
        self.anthropic_client = None
        
        # Инициализация клиентов если есть API ключи
        if os.getenv('OPENAI_API_KEY'):
            self.openai_client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        
        if os.getenv('ANTHROPIC_API_KEY'):
            self.anthropic_client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))
        
        if os.getenv('GOOGLE_AI_API_KEY'):
            genai.configure(api_key=os.getenv('GOOGLE_AI_API_KEY'))
    
    async def generate(self, prompt: str, context: str = "", provider_id: Optional[int] = None,
                      max_tokens: Optional[int] = None, temperature: Optional[float] = None) -> str:
        """Генерация текста через AI провайдер"""
        try:
            # Получаем провайдер из БД
            if provider_id:
                provider = await db.fetchrow(
                    "SELECT * FROM ai_providers WHERE id = $1 AND is_active = true",
                    provider_id
                )
            else:
                # Берем провайдер с наивысшим приоритетом
                provider = await db.fetchrow(
                    "SELECT * FROM ai_providers WHERE is_active = true ORDER BY priority DESC LIMIT 1"
                )
            
            if not provider:
                raise Exception("Нет доступных AI провайдеров")
            
            # Формируем полный промпт с контекстом
            full_prompt = prompt
            if context:
                full_prompt = f"Контекст:\n{context}\n\nЗапрос: {prompt}"
            
            # Используем параметры провайдера или переданные
            final_max_tokens = max_tokens or provider['max_tokens']
            final_temperature = temperature if temperature is not None else float(provider['temperature'])
            
            # Генерируем через соответствующий провайдер
            provider_type = provider['provider_type']
            
            if provider_type == 'openai':
                return await self._generate_openai(
                    provider, full_prompt, final_max_tokens, final_temperature
                )
            elif provider_type == 'anthropic':
                return await self._generate_anthropic(
                    provider, full_prompt, final_max_tokens, final_temperature
                )
            elif provider_type == 'google':
                return await self._generate_google(
                    provider, full_prompt, final_max_tokens, final_temperature
                )
            else:
                raise Exception(f"Неподдерживаемый тип провайдера: {provider_type}")
        
        except Exception as e:
            print(f"❌ Ошибка при генерации: {str(e)}")
            # Пробуем fallback на другой провайдер
            if provider_id:
                return await self.generate(prompt, context, None, max_tokens, temperature)
            raise
    
    async def _generate_openai(self, provider, prompt, max_tokens, temperature) -> str:
        """Генерация через OpenAI"""
        try:
            # Используем API key из провайдера или глобальный
            api_key = provider['api_key'] or os.getenv('OPENAI_API_KEY')
            client = openai.OpenAI(api_key=api_key)
            
            response = client.chat.completions.create(
                model=provider['model_name'],
                messages=[
                    {"role": "system", "content": "Ты полезный ассистент для ответов в Telegram."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=max_tokens,
                temperature=temperature
            )
            
            return response.choices[0].message.content
        
        except Exception as e:
            raise Exception(f"Ошибка OpenAI: {str(e)}")
    
    async def _generate_anthropic(self, provider, prompt, max_tokens, temperature) -> str:
        """Генерация через Anthropic Claude"""
        try:
            api_key = provider['api_key'] or os.getenv('ANTHROPIC_API_KEY')
            client = anthropic.Anthropic(api_key=api_key)
            
            response = client.messages.create(
                model=provider['model_name'],
                max_tokens=max_tokens,
                temperature=temperature,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            return response.content[0].text
        
        except Exception as e:
            raise Exception(f"Ошибка Anthropic: {str(e)}")
    
    async def _generate_google(self, provider, prompt, max_tokens, temperature) -> str:
        """Генерация через Google AI"""
        try:
            api_key = provider['api_key'] or os.getenv('GOOGLE_AI_API_KEY')
            genai.configure(api_key=api_key)
            
            model = genai.GenerativeModel(provider['model_name'])
            
            response = model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=max_tokens,
                    temperature=temperature
                )
            )
            
            return response.text
        
        except Exception as e:
            raise Exception(f"Ошибка Google AI: {str(e)}")
