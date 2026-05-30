"""天气查询技能 - 使用 wttr.in 免费 API"""
import urllib.request
import urllib.parse
import json
import re
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class WeatherSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="weather",
            name="天气查询",
            version="1.0.0",
            description="查询全球城市实时天气和多日预报",
            author="Friday",
            capabilities=["weather", "forecast", "temperature", "天气", "天气查询", "预报"],
            tags=["utility", "weather"],
            icon="🌤️",
        )

    async def handle(self, context: dict) -> SkillResult:
        query = context.get("query", "")
        city = self._extract_city(query)
        if not city:
            city = "Beijing"

        try:
            url = f"https://wttr.in/{urllib.parse.quote(city)}?format=j1"
            req = urllib.request.Request(url, headers={"User-Agent": "Friday/1.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))

            current = data.get("current_condition", [{}])[0]
            temp_c = current.get("temp_C", "?")
            feels_like = current.get("FeelsLikeC", "?")
            humidity = current.get("humidity", "?")
            desc_list = current.get("weatherDesc", [{}])
            desc = desc_list[0].get("value", "未知") if desc_list else "未知"
            wind_speed = current.get("windspeedKmph", "?")
            wind_dir = current.get("winddir16Point", "")

            result_text = (
                f"📍 {city}\n"
                f"🌡️ 温度: {temp_c}°C (体感 {feels_like}°C)\n"
                f"☁️ 天气: {desc}\n"
                f"💧 湿度: {humidity}%\n"
                f"💨 风速: {wind_speed} km/h {wind_dir}"
            )

            forecast_lines = []
            for day in data.get("weather", [])[:3]:
                date = day.get("date", "")
                max_t = day.get("maxtempC", "?")
                min_t = day.get("mintempC", "?")
                desc_day = day.get("hourly", [{}])[4].get("weatherDesc", [{}])
                desc_text = desc_day[0].get("value", "") if desc_day else ""
                forecast_lines.append(f"  {date}: {min_t}~{max_t}°C {desc_text}")

            if forecast_lines:
                result_text += "\n\n📅 未来预报:\n" + "\n".join(forecast_lines)

            return create_skill_result(result_text, data={"city": city, "temp": temp_c, "desc": desc})
        except Exception as e:
            return create_skill_result(f"天气查询失败: {e}", data={"error": str(e)})

    def _extract_city(self, query: str) -> str:
        patterns = [
            r"(.+?)的天气",
            r"(.+?)天气",
            r"天气\s*(.+)",
            r"weather\s+(.+)",
        ]
        for p in patterns:
            m = re.search(p, query, re.IGNORECASE)
            if m:
                return m.group(1).strip()
        if " " in query:
            return query.split()[-1]
        return query
