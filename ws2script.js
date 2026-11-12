let locationButton = document.getElementById('location-btn');
let searchForm = document.getElementById('location-search-form');
let cityInput = document.getElementById('city-input');
let message = document.getElementById('message');
let output = document.getElementById('output');
let when = document.getElementById('when');
let placeName = document.getElementById('place-name');
let scoreNumber = document.getElementById('score-number');
let verdict = document.getElementById('verdict');
let goldenTime = document.getElementById('golden-time');
let sunsetTime = document.getElementById('sunset-time');
let blueTime = document.getElementById('blue-time');
let cloudsList = document.getElementById('clouds-list');
let reminderBtn = document.getElementById('reminder-btn');
let reminderMessage = document.getElementById('reminder-message');

async function getCoords(city){
    try{
        let response = await fetch(`https://cse2004.com/api/geocode?address=${city}`);

        if(!response.ok){
            throw new Error('City search is not working right now. Please try again in a moment.');
        }
        
        let geoData = await response.json();
        let place = geoData?.results?.[0];
        let lat = place?.geometry?.location?.lat;
        let lng = place?.geometry?.location?.lng;

         if (!lat || !lng) {
          throw new Error(`"${city}" not found, check your spelling and try again.`);
        }

        return{
            name: place?.formatted_address ?? city,
            lat: lat,
            lng: lng
        };

    }
    catch (error) {
    return null;
    }
}

async function getClouds(lat, lng){
    try{
        let response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,precipitation_probability,cloud_cover_low,cloud_cover_mid,cloud_cover_high&temperature_unit=fahrenheit&timezone=auto&timeformat=unixtime`);
        if(!response.ok){
            throw new Error('The weather service is not responding, try again in a moment');
        }
        return await response.json();
    }
    catch (error) {
    return null;
    }
}

async function getSunTimes(lat, lng, date){
    try{
        let response = await fetch(`https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&date=${date}&formatted=0`);
        if(!response.ok){
            throw new Error('The sunset service is not responding, try again in a moment');
        }
        let data = await response.json();
        return{
            sunset: new Date(data.results.sunset),
            blueEnd: new Date(data.results.civil_twilight_end)
        };
    }
    catch (error) {
    return null;
    }
}

function dateInZone(date, timeZone){
    return new Intl.DateTimeFormat('en-CA', { timeZone: timeZone }).format(date);
}
 
function timeInZone(date, timeZone){
    return new Intl.DateTimeFormat('en-US', {hour: 'numeric', minute: '2-digit', timeZone: timeZone}).format(date);
}

function cloudsAt(hourly, sunset){
    let sunsetSeconds = sunset.getTime()/1000;
    let bestIndex = 0;

    for(i = 0; i < hourly.time.length; i++){
        let distance = Math.abs(hourly.time[i] - sunsetSeconds);
        let bestDistance = Math.abs(hourly.time[bestIndex] - sunsetSeconds);
        if(distance < bestDistance){
            bestIndex = i;
        }
    }

    return {
        low: hourly.cloud_cover_low[bestIndex] ?? 0,
        mid: hourly.cloud_cover_mid[bestIndex] ?? 0,
        high: hourly.cloud_cover_high[bestIndex] ?? 0,
        rain: hourly.precipitation_probability[bestIndex] ?? 0,
        temp: Math.round(hourly.temperature_2m[bestIndex])
    };
}

function scoreSunset(clouds){
    let canvas = Math.max(clouds.high, clouds.mid);
    let canvasQuality = 1 - Math.abs(canvas - 50)/50;
    let score = 30 + canvasQuality*70;
    score = score - clouds.low * 0.6;
    score = score - clouds.rain * 0.4;
    return Math.round(Math.min(Math.max(score, 0), 100));
}

function getVerdict(score){
    if (score == 100){
        return{mood: 'perfect', text: 'Could not ask for a better sunset!'}
    }
    else if (score >= 75){
        return{mood: 'great', text: 'Definitely a sunset worth checking out!'}
    }
    else if (score >= 50){
        return{mood: 'okay', text: 'Seems promising, might be worth your time!'}
    }
    else if (score >= 35){
        return{mood: 'fair', text: 'Fine, but not worth dropping everything for.'}
    }
    else{
        return{mood: 'poor', text: 'The sky disappoints today.'}
    }
}

async function showForecast(place){
    output.hidden = true;
    message.textContent = `Checking the sky in ${place.name}...`;

    try{
        let weather = await getClouds(place.lat, place.lng);
        let timeZone = weather.timezone;

        let label = 'Tonight';
        let today = dateInZone(new Date(), timeZone);
        let sun = await getSunTimes(place.lat, place.lng, today);

        if(sun.blueEnd < new Date()){
            let tomorrow = dateInZone(new Date(Date.now() + 24*60*60*1000), timeZone);
            sun = await getSunTimes(place.lat, place.lng, tomorrow);
            label = 'Tomorrow night';
        }

        let clouds = cloudsAt(weather.hourly, sun.sunset);
        let score = scoreSunset(clouds);
        let result = getVerdict(score);
        let goldenStart = new Date(sun.sunset.getTime() - 60*60*1000);

        currentForecast = {place, goldenStart, score, result, timeZone};

        when.textContent = label;
        placeName.textContent = place.name;
        scoreNumber.textContent = score;
        let scoreFill = document.getElementById('score-fill');
        scoreFill.style.setProperty('--score', `${score}%`);
        verdict.textContent = result.text;
        goldenTime.textContent = `${timeInZone(goldenStart, timeZone)} – ${timeInZone(sun.sunset, timeZone)}`;
        sunsetTime.textContent = timeInZone(sun.sunset, timeZone);
        blueTime.textContent = timeInZone(sun.blueEnd, timeZone);

        cloudsList.innerHTML = `
            <li>Temperature: ${clouds.temp}°F</li>
            <li>Rain chance: ${clouds.rain}%</li>
            <li>High clouds: ${clouds.high}%</li>
            <li>Mid clouds: ${clouds.mid}%</li>
            <li>Low clouds: ${clouds.low}%</li>`;

        document.body.className = `mood-${result.mood}`;
        message.textContent = '';
        output.hidden = false;
    }
            catch (error){
        message.textContent = error.message;
    }
}

locationButton.addEventListener('click', () => {
    if(!navigator.geolocation){
        message.textContent = "Your browser cannot share location. Type a city instead.";
        cityInput.focus();
        return;
    }

    message.textContent = 'Grabbing your location...';

    navigator.geolocation.getCurrentPosition(
        (position) => {
            showForecast({name: 'Your location', lat: position.coords.latitude, lng: position.coords.longitude});
        },
        (error) => {
            if (error.code === error.PERMISSION_DENIED){
                message.textContent = 'Location is blocked. Try enabling location services, or type a city instead!';
            }
            else{
                message.textContent = "We couldn't find your location. Type a city instead.";
            }
            cityInput.focus();
        },
        { timeout: 10000 }
    );
})

searchForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    let city=cityInput.value.trim();
    if(!city){
        message.textContent = 'Please enter a city name.';
        return;
    }

    message.textContent = `Looking up ${city}...`;

    try{
        let place = await getCoords(city);
        showForecast(place);
    }
    catch (error){
        if (error instanceof TypeError){
            message.textContent = "Couldn't connect. Check your internet and try again.";
        }
        else{
            message.textContent = error.message;
        }
    }
})