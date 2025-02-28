// get user's location
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function (location) {
        // call function to populate app with data
        populateHTML(location.coords.latitude, location.coords.longitude)
    }, function (error) {
        strError = ''

        // alert user to enable location sharing if denied or other error
        if (error.code === error.PERMISSION_DENIED) {
            strError = 'Please enable location sharing in your settings!'
        } else {
            strError = 'There was an issue getting your location!'
        }

        Swal.fire({
            title: strError,
            icon: 'error'
        })
    })
}

// function that populates data into the html
async function populateHTML(fltLatitude, fltLongitude) {
    // call function to get data from api
    let strWeatherApiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${fltLatitude}&longitude=${fltLongitude}&current=temperature_2m,relative_humidity_2m,is_day,precipitation,weather_code&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto&forecast_days=1`
    let strGeocodingApiUrl = `https://nominatim.openstreetmap.org/reverse.php?lat=${fltLatitude}&lon=${fltLongitude}&zoom=10&format=json`
    const objWeatherData = await getData(strWeatherApiUrl)
    const objGeocodeData = await getData(strGeocodingApiUrl)

    // get city and state
    const strCity = objGeocodeData.name
    let strState = objGeocodeData.address.state
    // get state abbreviation if in the US
    if (objGeocodeData.address.country === "United States") {
        strState = getStateAbbr(strState)
    }

    // get all necessary data
    const objHourly = objWeatherData.hourly
    const strTempUnit = objWeatherData.current_units.temperature_2m
    const strHumidityUnit = objWeatherData.current_units.relative_humidity_2m
    const blnIsDay = objWeatherData.current.is_day
    const fltCurrTemp = objWeatherData.current.temperature_2m
    const intCurrHumidity = objWeatherData.current.relative_humidity_2m
    const intCurrWeatherCode = objWeatherData.current.weather_code
    const fltDailyTempMax = objWeatherData.daily.temperature_2m_max
    const fltDailyTempMin = objWeatherData.daily.temperature_2m_min

    // get specific icons based on data
    const objConditions = getConditionAndIcon(intCurrWeatherCode, blnIsDay)
    const objTempIcon = getTempIcon(fltCurrTemp)

    // change bg colors based on day/night
    if (blnIsDay) {
        document.querySelector('body').className = "bg-day"
    } else {
        document.querySelector('body').className = "bg-night"
    }

    // input all data into the html
    document.querySelector('#txtLocation').innerHTML = strCity + ", " + strState
    document.querySelector('#iconTemp').className = objTempIcon.icon
    document.querySelector('#iconTemp').setAttribute('aria-label', objTempIcon.ariaLabel)
    document.querySelector('#txtTemp').innerHTML = fltCurrTemp + strTempUnit
    document.querySelector('#iconCondition').className = objConditions.icon
    document.querySelector('#iconCondition').setAttribute('aria-label', objConditions.ariaLabel)
    document.querySelector('#txtCondition').innerHTML = objConditions.condition
    document.querySelector('#txtHighTemp').innerHTML += 'High: ' + fltDailyTempMax + strTempUnit
    document.querySelector('#txtLowTemp').innerHTML += 'Low: ' + fltDailyTempMin + strTempUnit
    document.querySelector('#txtHumidityHeader').innerHTML = 'Humidity'
    document.querySelector('#txtHumidity').innerHTML += intCurrHumidity + strHumidityUnit

    // call function to render chart with data for the day
    renderChart(objHourly)
}

// function to render chart using ApexCharts.js
function renderChart(objData) {
    // data for each chart type option
    const objChartData = {
        temperature: {
            name: 'Temperature',
            data: objData.temperature_2m,
            yaxisSuffix: '°'
        },
        humidity: {
            name: 'Humidity',
            data: objData.relative_humidity_2m,
            yaxisSuffix: '%'
        },
        precipitation: {
            name: 'Precipitation',
            data: objData.precipitation_probability,
            yaxisSuffix: '%'
        },
        wind: {
            name: 'Wind',
            data: objData.wind_speed_10m,
            yaxisSuffix: "mph"
        }
    }

    const options = {
        series: [{
            name: objChartData.temperature.name,
            data: objChartData.temperature.data
        }],
        chart: {
            height: 250,
            type: 'area',
            background: '#D3F4FF',
            toolbar: {
                show: false
            },
            zoom: {
                enabled: false
            }
        },
        colors: ['#58bbf9'],
        dataLabels: {
            enabled: false
        },
        stroke: {
            curve: 'smooth'
        },
        xaxis: {
            type: 'datetime',
            categories: objData.time,
            labels: {
                // 12-hour format with AM/PM suffix
                formatter: function (value) {
                    const date = new Date(value)
                    let intHours = date.getHours()
                    let strSuffix = intHours >= 12 ? 'PM' : 'AM'
                    intHours = intHours % 12 || 12
                    return `${intHours} ${strSuffix}`
                }
            },
            tickAmount: 4
        },
        yaxis: {
            labels: {
                formatter: function (value) {
                    return value + '°'
                }
            }
        }
    }

    const chart = new ApexCharts(document.querySelector("#chart"), options)
    chart.render()

    // listen for change in selection and update chart accordingly
    document.querySelector('#selChartType').addEventListener('change', function (event) {
        const strType = event.target.value
        chart.updateOptions({
            series: [{
                name: objChartData[strType].name,
                data: objChartData[strType].data
            }],
            yaxis: {
                labels: {
                    formatter: function (value) {
                        return value + objChartData[strType].yaxisSuffix
                    }
                }
            }
        })
    })
}

// function to get data from a url
async function getData(strUrl) {
    const objResponse = await fetch(strUrl, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    })

    if (!objResponse.ok) {
        throw new Error('HTTP Error Status', objResponse.status)
    }

    const objData = await objResponse.json()
    return objData
}

// function that returns an object for a bootstrap icon and aria-label
//      based on temperature
function getTempIcon(fltTemp) {
    let strIcon = ""
    let strAriaLabel = ""
    if (fltTemp > 80) {
        strIcon = "bi bi-thermometer-high"
        strAriaLabel = "High thermometer icon"
    } else if (fltTemp > 60) {
        strIcon = "bi bi-thermometer-half"
        strAriaLabel = "Half thermometer icon"
    } else if (fltTemp > 30) {
        strIcon = "bi bi-thermometer-low"
        strAriaLabel = "Low thermometer icon"
    } else {
        strIcon = "bi bi-thermometer"
        strAriaLabel = "Very low thermometer icon"
    }

    return {"icon": strIcon, "ariaLabel": strAriaLabel}
}

// function that returns an object for the weather condition, bootstrap icon,
//      and aria-label based on weather code and day/night
function getConditionAndIcon(intWeatherCode, blnIsDay) {
    let strCondition = ""
    let strIcon = ""
    let strAriaLabel = ""
    switch (intWeatherCode) {
        case 0:
            if (blnIsDay) {
                strCondition = "Sunny"
                strIcon = "bi bi-sun"
                strAriaLabel = "Sun icon"
            } else {
                strCondition = "Clear"
                strIcon = "bi bi-moon-stars"
                strAriaLabel = "Moon icon"
            }
            break
        case 1:
            if (blnIsDay) {
                strCondition = "Mostly Sunny"
                strIcon = "bi bi-sun"
                strAriaLabel = "Sun icon"
            } else {
                strCondition = "Mostly Clear"
                strIcon = "bi bi-moon"
                strAriaLabel = "Moon icon"
            }
            break
        case 2:
            if (blnIsDay) {
                strCondition = "Partly Cloudy"
                strIcon = "bi bi-cloud-sun"
                strAriaLabel = "Clouded sun icon"
            } else {
                strCondition = "Partly Cloudy"
                strIcon = "bi bi-cloud-moon"
                strAriaLabel = "Clouded moon icon"
            }
            break
        case 3:
            strCondition = "Overcast"
            strIcon = "bi bi-cloudy"
            strAriaLabel = "Cloud icon"
            break
        case 45:
            strCondition = "Fog"
            strIcon = "bi bi-cloud-fog2"
            strAriaLabel = "Fog cloud icon"
            break
        case 48:
            strCondition = "Rime Fog"
            strIcon = "bi bi-cloud-fog2"
            strAriaLabel = "Fog cloud icon"
            break
        case 51:
            strCondition = "Light Drizzle"
            strIcon = "bi bi-cloud-drizzle"
            strAriaLabel = "Drizzle cloud icon"
            break
        case 53:
            strCondition = "Drizzle"
            strIcon = "bi bi-cloud-drizzle"
            strAriaLabel = "Drizzle cloud icon"
            break
        case 55:
            strCondition = "Heavy Drizzle"
            strIcon = "bi bi-cloud-drizzle"
            strAriaLabel = "Drizzle cloud icon"
            break
        case 56:
            strCondition = "Light Freezing Drizzle"
            strIcon = "bi bi-cloud-drizzle"
            strAriaLabel = "Drizzle cloud icon"
            break
        case 57:
            strCondition = "Heavy Freezing Drizzle"
            strIcon = "bi bi-cloud-drizzle"
            strAriaLabel = "Drizzle cloud icon"
            break
        case 61:
            strCondition = "Light Rain"
            strIcon = "bi bi-cloud-rain"
            strAriaLabel = "Rain cloud icon"
            break
        case 63:
            strCondition = "Rain"
            strIcon = "bi bi-cloud-rain"
            strAriaLabel = "Rain cloud icon"
            break
        case 65:
            strCondition = "Heavy Rain"
            strIcon = "bi bi-cloud-rain-heavy"
            strAriaLabel = "Heavy rain cloud icon"
            break
        case 66:
            strCondition = "Light Freezing Rain"
            strIcon = "bi bi-cloud-sleet"
            strAriaLabel = "Sleet cloud icon"
            break
        case 67:
            strCondition = "Heavy Freezing Rain"
            strIcon = "bi bi-cloud-sleet"
            strAriaLabel = "Sleet cloud icon"
            break
        case 71:
            strCondition = "Light Snowfall"
            strIcon = "bi bi-cloud-snow"
            strAriaLabel = "Snow cloud icon"
            break
        case 73:
            strCondition = "Snow"
            strIcon = "bi bi-cloud-snow"
            strAriaLabel = "Snow cloud icon"
            break
        case 75:
            strCondition = "Heavy Snow"
            strIcon = "bi bi-cloud-snow"
            strAriaLabel = "Snow cloud icon"
            break
        case 77:
            strCondition = "Snow Grains"
            strIcon = "bi bi-cloud-snow"
            strAriaLabel = "Snow cloud icon"
            break
        case 80:
            strCondition = "Light Rain Shower"
            strIcon = "bi bi-cloud-rain"
            strAriaLabel = "Rain cloud icon"
            break
        case 81:
            strCondition = "Rain Shower"
            strIcon = "bi bi-cloud-rain"
            strAriaLabel = "Rain cloud icon"
            break
        case 82:
            strCondition = "Heavy Rain Shower"
            strIcon = "bi bi-cloud-rain-heavy"
            strAriaLabel = "Heavy rain cloud icon"
            break
        case 85:
            strCondition = "Light Snow Shower"
            strIcon = "bi bi-cloud-snow"
            strAriaLabel = "Snow cloud icon"
            break
        case 86:
            strCondition = "Heavy Snow Shower"
            strIcon = "bi bi-cloud-snow"
            strAriaLabel = "Snow cloud icon"
            break
        case 95:
            strCondition = "Thunderstorm"
            strIcon = "bi bi-cloud-lightning-rain"
            strAriaLabel = "Lightning cloud icon"
            break
        case 96:
            strCondition = "Light Hail Thunderstorm"
            strIcon = "bi bi-cloud-lightning-rain"
            strAriaLabel = "Lightning cloud icon"
            break
        case 99:
            strCondition = "Heavy Hail Thunderstorm"
            strIcon = "bi bi-cloud-lightning-rain"
            strAriaLabel = "Lightning cloud icon"
            break
        default:
            strCondition = "Unknown"
    }
    return {"condition": strCondition, "icon": strIcon, "ariaLabel": strAriaLabel}
}

// function that returns the specified state's abbreviation
function getStateAbbr(strState) {
    const objStateMapping = {
        "Alabama": "AL",
        "Alaska": "AK",
        "Arizona": "AZ",
        "Arkansas": "AR",
        "California": "CA",
        "Colorado": "CO",
        "Connecticut": "CT",
        "Delaware": "DE",
        "District Of Columbia": "DC",
        "Florida": "FL",
        "Georgia": "GA",
        "Hawaii": "HI",
        "Idaho": "ID",
        "Illinois": "IL",
        "Indiana": "IN",
        "Iowa": "IA",
        "Kansas": "KS",
        "Kentucky": "KY",
        "Louisiana": "LA",
        "Maine": "ME",
        "Maryland": "MD",
        "Massachusetts": "MA",
        "Michigan": "MI",
        "Minnesota": "MN",
        "Mississippi": "MS",
        "Missouri": "MO",
        "Montana": "MT",
        "Nebraska": "NE",
        "Nevada": "NV",
        "New Hampshire": "NH",
        "New Jersey": "NJ",
        "New Mexico": "NM",
        "New York": "NY",
        "North Carolina": "NC",
        "North Dakota": "ND",
        "Ohio": "OH",
        "Oklahoma": "OK",
        "Oregon": "OR",
        "Pennsylvania": "PA",
        "Rhode Island": "RI",
        "South Carolina": "SC",
        "South Dakota": "SD",
        "Tennessee": "TN",
        "Texas": "TX",
        "Utah": "UT",
        "Vermont": "VT",
        "Virginia": "VA",
        "Washington": "WA",
        "West Virginia": "WV",
        "Wisconsin": "WI",
        "Wyoming": "WY"
    };

    return objStateMapping[strState]
}