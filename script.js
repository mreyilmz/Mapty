"use strict";

// prettier-ignore

const form = document.querySelector(".form");
const containerWorkouts = document.querySelector(".workouts");
const inputType = document.querySelector(".form__input--type");
const inputDistance = document.querySelector(".form__input--distance");
const inputDuration = document.querySelector(".form__input--duration");
const inputCadence = document.querySelector(".form__input--cadence");
const inputElevation = document.querySelector(".form__input--elevation");

// map değişkeni navigator.geolocation'ın cb function'ın dışında da gerekli olduğu için global variable olarak tanımladık.
// let map, mapEvent;
// navigator.geolocation ile mutlak konumumuzu browserdan alabiliyoruz
// ilk cb func konumumuzu, ikinci cb ise hata cb func'ı verir.

class Workout {
  // id oluşturmak için herhangi bir library kullanmıyoruz biz de id yerine geçebilicek bir şey oluşturduk. Date'in son 10 hanesi bizim id miz olacak.
  // Public Fields
  date = new Date();
  id = (Date.now() + "").slice(-10);
  click = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier'in çalışmasını istemediğimiz satırın üstünde alttaki kodu kullanabiliriz.
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    // type workout class içinde tanımlı olmamasına rağmen burda kullanabiliyoruz
    // Fakat _setDescription methodunu bu class içinde çağıramayız çünkü type belli değil ama childlar kullanabilir.
    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  clicks() {
    this.click++;
  }
}

class Running extends Workout {
  // Public Fields
  type = "running";
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }
  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  // Public Fields
  type = "cycling";
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }
  calcSpeed() {
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}
const run1 = new Running([39, -12], 5.2, 24, 178);
const cycling1 = new Cycling([39, -12], 27, 95, 523);
console.log(run1, cycling1);

////////////////////////////////////////////////////////////////////////////////////////////
// APPLICATION ARCHITECTURE
class App {
  // Private Instances Properties
  #workouts = [];
  #map;
  #mapEvent;
  #mapZoomLevel = 13;
  constructor() {
    // _getPosition()'dan sonra _loadMap() çalışacak
    // Initial olarak çalıştırmak için constructor içinde fonksiyonu çağırıdk. Pythonda da buna benzer bir yöntem vardı. Constructor içinde çalıştırmasaydık class dışında
    // const app = new App(), app._getPosition() kod satırlarını yazardık.
    this._getPosition();

    //Get data from local storage
    this._getLocalStorage();

    // Submit butonumuz olmadığı için, submit event olarak dinlicez. eventListener içinde eventListener olmayacağı için dışarı çıkardık. if(navigator.geolocation) ile de alakası olmadığı için if'in içine de koymadık.
    // _newWorkout da argument olduğu için regular fonk gibi çağrıldı bu yüzde bind methoduyla this'i this'e eşitledik.
    form.addEventListener("submit", this._newWorkout.bind(this));

    // inputType'ın iki tane seçeneği var, biri cycling, diğeri running. Seçenekte değişiklik olduğu zaman change adında bir event yayıyor. Bizde bunu yakaladık ve her değişiklik olduğunda inputElevation ve inputCadence'ı toggle yapıcaz
    inputType.addEventListener("change", this._toggleElevationField);
    // Soldaki workout listesinden bir elemana tıklandığı zaman elemanın id.sini alıp workout datasındaki id.lerle karşılaştıracak id.lerden biriyle eşleşme olacak ve harita o işaretçiye doğru hareket edecek. Methodu arguman olarak kullandığımız için .bind methodunu kullanmak durumunda kaldık.
    containerWorkouts.addEventListener("click", this._moveToPopup.bind(this));
  }

  _getPosition() {
    if (navigator.geolocation) {
      // Kullanıcının konumu belli olduktan sonra _loadMap methodu çağırılacak ve position argument olarak _loadMap içine gönderilicek.
      navigator.geolocation.getCurrentPosition(
        // getCurrentPosition içine argument olarak method girdik fakat regular fonk gibi algılayıp çağırdı ve this methodu undefined'a eşit oldu. Bu yüzden bind methoduyla this'in this'e eşit olmasını sağğladık. Ayrıca bind methodu yeni bir fonk döndürür o yüzden sorun olmadı.
        this._loadMap.bind(this),
        function () {
          alert("Could not get your position.");
        }
      );
    }
  }

  _loadMap(position) {
    //console.log(position);
    // Bu şekilde position.coords içindeki longitude ve latitude propertylerini, aynı isimli değişkenlere atadık.
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    console.log(latitude, longitude);
    const coords = [latitude, longitude];

    // Leaflet open-source library sinden aldığımız kod. map() içindeki değer mapin ekleneceği div'in id'si. 13: zoom level büyükdükçe yakınlaşıyor
    //
    this.#map = L.map("map").setView(coords, this.#mapZoomLevel);
    L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // .on method js'nin değil leaflet ile gelen bir method. Konsolda map'a baktığımıza _asd, _qwe gibi methodlar gördük.Bunlar protected methodlar yani bunları manipule etmememiz gerekiyor.
    this.#map.on("click", this._showForm.bind(this));

    this.#workouts.forEach((work) => {
      this._renderWorkout(work);
      // getLocalStorage methodu başlangıçta execute ediliyor ve _renderWorkoutMarker() methodu hata veriyor. Çünkü map'i third-party library'den kullandığımız için map daha yüklenemeden getLocalStorage methodu çalıştığı için ve ortada henüz map olmadığı için _renderWorkoutMarker(work) methodu hata veriyor. Kodun hata vermesine neden olan kod satırı ise bu: .addTo(this.#map). Bu yüzden kod parçamızı _loadMap içine taşıdık. loadmap execute edildikten sonra bu kod satırımız çalışacak Bu durum asynchronous Js ile çözülebilir.
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    // mapE'ye bu fonk içinde ihtiyacımız olmadığı için mapEvent adıyla global değişken tanımlayıp eşitledik ve form.eventListener içinde kullandık bu eventi.
    this.#mapEvent = mapE;
    // Haritaya tıkladığımızda formda bulunan hidden class'ını sildik.
    form.classList.remove("hidden");
    // formda distance inputuna focusladık.
    inputDistance.focus();
  }

  _hideForm() {
    // Clear input fields
    // prettier-ignore
    inputDistance.value = inputDuration.value = inputElevation.value = inputCadence.value = "";
    // Kayma animasyonunun gerçekleşememesi için diplay'i none yaptık animasyona girmeden önce
    form.style.display = "none";
    form.classList.add("hidden");
    setTimeout(() => (form.style.display = "grid"), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest(".form__row").classList.toggle("form__row--hidden");
    inputCadence.closest(".form__row").classList.toggle("form__row--hidden");
  }

  _newWorkout(e) {
    // Tüm inputlar sayıysa true biri bile sayı değilse false döndürür
    const validInputs = (...inputs) =>
      inputs.every((input) => Number.isFinite(input));
    // inputlar positive se true biri bile değilse false döndürecek.
    const allPositive = (...inputs) => inputs.every((input) => input > 0);
    // form submit olunca def olarak sayfayı yenilediği için yine bu kodu kullandık.
    e.preventDefault();
    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // If workout running, create running object
    if (type === "running") {
      const cadence = +inputCadence.value;
      // Check if data is valid
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        // Guard Clause
        return alert("Inputs have to be positive numbers!");
      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // If workout cycling, create cycling object
    if (type === "cycling") {
      const elevation = +inputElevation.value;
      // Check if data is valid
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        // Guard Clause
        return alert("Inputs have to be positive numbers!");
      workout = new Cycling([lat, lng], distance, duration, elevation);
    }
    // Add new object to workout array
    this.#workouts.push(workout);
    console.log(workout);

    // Render workout on map as marker
    // renderWorkoutMarker'ı method olarak çağırdığımız için bind methodu kullanmamıza gerek kalmadı.
    this._renderWorkoutMarker(workout);

    // Render workout on list
    this._renderWorkout(workout);

    // Hide form + clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();
  }
  // Display Marker
  // console.log(mapEvent);
  // Tıkladığımız yerin lat ve lng değerlerini aldık.
  _renderWorkoutMarker(workout) {
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === "running" ? "🏃‍♂️" : "🚴‍♀️"} ${workout.description}`
      )
      .openPopup();
  }

  _renderWorkout(workout) {
    let html = `
    <li class="workout workout--${workout.type}" data-id="${workout.id}">
      <h2 class="workout__title">${workout.description}</h2>
      <div class="workout__details">
        <span class="workout__icon">${
          workout.type === "running" ? "🏃‍♂️" : "🚴‍♀️"
        }</span>
        <span class="workout__value">${workout.distance}</span>
        <span class="workout__unit">km</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⏱</span>
        <span class="workout__value">${workout.duration}</span>
        <span class="workout__unit">min</span>
      </div>
    `;
    if (workout.type === "running")
      html += `
        <div class="workout__details">
          <span class="workout__icon">${workout.pace.toFixed(1)}</span>
          <span class="workout__value">4.6</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      </li>
      `;
    if (workout.type === "cycling")
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
      </li>
      `;
    form.insertAdjacentHTML("afterend", html);
  }
  _moveToPopup(e) {
    const workoutEl = e.target.closest(".workout");
    //console.log(workoutEl);

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      (work) => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: { duration: 1 },
    });

    // localStorage'dan gelen datayı tekrar object'e çevirdiğimizde, yeni oluşan object artık normal bir object. Class kullanarak oluşturduğumuz childlar ve prototypal inharitance bozulduğu için bu methodu devre dışı bıraktık. Bu sorun, tekrar objecte çevirdiğimizde objectleri loop edip new object yaparak çözebiliriz.
    //workout.clicks();
    console.log(workout);
  }

  _setLocalStorage() {
    // local storage is an API that the browser provides for us. Local storage is a very simple API. It is only advised to use for small amounts of data
    // Fazla miktarda data yavaşlamaya sebep olur
    // First parameter is a name, second parameter needs to be a string that we want to store and which will be associated with this key.
    //Local storage is a simple key value store
    // ilk argument key, ikincisi value gibi düşünebiliriz.
    // JSON.stringify object'i stringe dönüştürür.
    //
    localStorage.setItem("workouts", JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    // localStorage'dan gelen data string olduğu için onu tekrar object'e çevirdik
    const data = JSON.parse(localStorage.getItem("workouts"));
    console.log(data);

    // Guard Clause
    if (!data) return;

    this.#workouts = data;
  }

  reset() {
    localStorage.removeItem("workouts");
    // location is basicaly a big object that contains a lot of methods and properties in the browser. And one of the methods is the ability to reload the page.
    // Konsola bu kod yazılırsa tüm workout kayıtlarını siler.
    location.reload();
  }
}

const app = new App();
