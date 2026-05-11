"""
JARVIS Weather Plugin
Fetches weather from OpenWeatherMap API.
"""

import aiohttp
from loguru import logger

from core.config import Config
from plugins.plugin_base import PluginBase


class WeatherPlugin(PluginBase):
    name = "weather"
    description = "Get current weather for any city"

    def __init__(self, config: Config):
        self.config = config
        self._api_key = config.weather_api_key

    async def initialize(self):
        logger.info("Weather plugin ready")

    async def get_weather(self, location: str) -> str:
        """Fetch current weather for a location."""
        if not self._api_key:
            return f"Weather API key not configured. Please add WEATHER_API_KEY to .env"

        url = "https://api.openweathermap.org/data/2.5/weather"
        params = {
            "q": location,
            "appid": self._api_key,
            "units": "metric",
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return self._format_weather(data, location)
                    elif resp.status == 404:
                        return f"I couldn't find weather data for {location}."
                    else:
                        return f"Weather service returned an error. Please try again."
        except Exception as e:
            logger.error(f"Weather fetch error: {e}")
            return f"I couldn't fetch the weather right now. Please check your internet connection."

    def _format_weather(self, data: dict, location: str) -> str:
        """Format weather data into a natural speech response."""
        city = data.get("name", location)
        country = data.get("sys", {}).get("country", "")
        temp = round(data.get("main", {}).get("temp", 0))
        feels_like = round(data.get("main", {}).get("feels_like", 0))
        description = data.get("weather", [{}])[0].get("description", "unknown")
        humidity = data.get("main", {}).get("humidity", 0)
        wind_speed = round(data.get("wind", {}).get("speed", 0) * 3.6)  # m/s to km/h

        return (
            f"In {city}, {country}, it's currently {temp}°C with {description}. "
            f"It feels like {feels_like}°C. "
            f"Humidity is {humidity}% and wind speed is {wind_speed} kilometers per hour."
        )
