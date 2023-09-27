'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    // this.date = ...
    // this.id = ...
    this.coords = coords; // [lat,lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    ++this.clicks;
  }
}

class Running extends Workout {
  type = 'running';

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
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    // this.type = 'cycling';
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

////////////////////////////////////
// APPLICATION ARCHITECTURE
const body = document.querySelector('body');
const sideBar = document.querySelector('.sidebar');
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

const menu = document.querySelector('menu');
const menuItemEdit = document.querySelector('menu__item--edit');
const menuItemDelete = document.querySelector('menu__item--delete');
const menuItemClear = document.querySelector('menu__item--clear');
const menuItemSort = document.querySelector('menu__item--Sort');
const editButton = document.querySelector('.edit-button');
const overviewButton = document.querySelector('.overview-button');
const sortButton = document.querySelector('.sort-button');

class App {
  // Private class field
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #markers = [];
  #workouts = [];
  #isEdit = false;
  #editedWorkout = {};
  #editedWorkoutIndex;
  #ascending = true;

  // Sayfa yuklendikten sonra App classi olusturuldugunda constructor objesi calisir.
  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Attach event handlers
    /* 
    Event handler icindeki bir methodun this keywordu, o eventin
     bagli oldugu elementi gosterir. Asagidaki ornekte 
     this keyword form elementini gosterir. Bunu engellemek icin
     bind methodunu kullanarak this keywordunun App classini
     gostermesini sagliyoruz. 
    */
    form.addEventListener('submit', this._newWorkout.bind(this));
    /* _toggleElevationField methodu icerisinde this keywordune gerek olmadigi
    icin bind kullanmaya gerek yok */
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));

    // Listener for edit button
    containerWorkouts.addEventListener('click', this._edit.bind(this));

    body.addEventListener('click', this._hideEditModal.bind(this));
    // Listener for edit workout action
    form.addEventListener('submit', this._editWorkout.bind(this));

    inputType.addEventListener('change', this._toggleElevationField);

    // Overview all workouts on the map
    overviewButton.addEventListener('click', this._overviewWorkouts.bind(this));

    // Sort workout by distance (ascending or descending)
    sortButton.addEventListener('click', this._sortWorkouts.bind(this));
  }

  _overviewWorkouts() {
    if (this.#markers.length <= 0) return;

    const group = new L.featureGroup(this.#markers);

    this.#map.fitBounds(group.getBounds(), {
      padding: [150, 150],
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  _sortWorkouts() {
    if (this.#workouts.length <= 0) return;

    if (this.#ascending) {
      this.#workouts.sort((first, second) => second.distance - first.distance);
      console.log(this.#workouts);
      this._reRenderWorkouts();
      this.#ascending = false;
    } else {
      this.#workouts.sort((first, second) => first.distance - second.distance);
      console.log(this.#workouts);
      this._reRenderWorkouts();
      this.#ascending = true;
    }
  }

  _hideEditModal(e) {
    const clickedElement = e.target;
    const menuArray = [...document.getElementsByClassName('menu')];

    // if (clickedElement.classList.contains('edit-button')) return;

    if (!clickedElement.closest('.workout')) {
      menuArray.forEach(el => {
        el.classList.add('menu__hidden');
        // this._hideForm();
      });
    } else {
      menuArray.forEach(el => {
        console.log(el.closest('.workout').dataset.id);
        if (
          clickedElement.closest('.workout').dataset.id !==
          el.closest('.workout').dataset.id
        )
          el.classList.add('menu__hidden');
        // this._hideForm();
      });
    }
  }

  _edit(e) {
    const clickedElement = e.target;
    const workoutEl = clickedElement.closest('.workout');
    if (!workoutEl) return;
    const menu = clickedElement.closest('.workout').querySelector('.menu');

    if (clickedElement.classList.contains('edit-button')) {
      // const menu = clickedElement.closest('.workout').querySelector('.menu');
      menu.classList.toggle('menu__hidden');

      if (menu.classList.contains('menu__hidden')) {
        this._hideForm();
      }
    }

    if (clickedElement.classList.contains('menu__item--edit')) {
      this.#isEdit = true;
      menu.classList.toggle('menu__hidden');
      this._selectWorkout(workoutEl);

      inputType.value = this.#editedWorkout.type;
      inputDistance.value = this.#editedWorkout.distance;
      inputDuration.value = this.#editedWorkout.duration;

      if (this.#editedWorkout.type === 'running') {
        inputCadence
          .closest('.form__row')
          .classList.remove('form__row--hidden');
        inputElevation.closest('.form__row').classList.add('form__row--hidden');
        inputCadence.value = this.#editedWorkout.cadence;
      }

      if (this.#editedWorkout.type === 'cycling') {
        console.log('Elevation');

        inputCadence.closest('.form__row').classList.add('form__row--hidden');
        inputElevation
          .closest('.form__row')
          .classList.remove('form__row--hidden');
        inputElevation.value = this.#editedWorkout.elevationGain;
      }

      // this.#editedWorkout.type === 'Running'
      //   ? (inputCadence.value = this.#editedWorkout.cadence)
      //   : (inputElevation.value = this.#editedWorkout.elevationGain);

      console.log(this.#editedWorkout);

      this._showForm();
    }

    if (clickedElement.classList.contains('menu__item--delete')) {
      this._selectWorkout(workoutEl);
      this.#workouts.splice(this.#editedWorkoutIndex, 1);
      this._reRenderWorkouts();
      // Hide the form and Clear input fields
      this._hideForm();

      // Set local storage to all workouts
      this._setLocalStorage();
      this.#editedWorkout = {};
      console.log(this.#workouts);
      this._overviewWorkouts();
    }

    if (clickedElement.classList.contains('menu__item--clear')) {
      this._clearAllWorkouts();
      this._reRenderWorkouts();
      // Set local storage to all workouts
      this._setLocalStorage();
      console.log('Clear all');
      console.log(this.#workouts);
    }
  }

  _clearAllWorkouts() {
    this.#workouts.splice(0, this.#workouts.length);
  }

  _selectWorkout(workoutEl) {
    this.#editedWorkout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );
    this.#editedWorkoutIndex = this.#workouts.indexOf(this.#editedWorkout);
  }

  _getPosition() {
    // Geolocation API
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
    }
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    const coords = [latitude, longitude];

    this.#map = L.map('map', {
      zoomSnap: 0.1,
    });

    //Ilk gorunumu konuma gore ayarla
    this.#map.setView(coords, this.#mapZoomLevel, {
      animate: true,
      duration: 1.5,
      pan: {
        duration: 1,
      },
    });

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Coming from Leaflet library
    // Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    /* Local storagetan cekilen veri map yuklenmeden render edilmez.
    Bu yuzden burada render methodunu cagiriyoruz. */
    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });

    //Gorunumu overviewa gore ayarla
    this._overviewWorkouts();
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // Empty inputs
    // inputType.value = 'Running';
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    if (inputType.value === 'running') {
      inputElevation.closest('.form__row').classList.add('form__row--hidden');
      inputCadence.closest('.form__row').classList.remove('form__row--hidden');
    }

    if (inputType.value === 'cycling') {
      inputElevation
        .closest('.form__row')
        .classList.remove('form__row--hidden');
      inputCadence.closest('.form__row').classList.add('form__row--hidden');
    }
  }

  _newWorkout(e) {
    if (this.#isEdit) return;

    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));

    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // If workout activity running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      // Check if data is valid
      if (
        // !Number.isFinite(distance) ||
        // !Number.isFinite(duration) ||
        // !Number.isFinite(cadence)
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return alert('Input have to be positive numbers!');

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // If workout activity cycling, create cycling object
    if (type === 'cycling') {
      // Check if data is valid
      const elevation = +inputElevation.value;
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return alert('Input have to be positive numbers!');

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // Add new object to workout array
    this.#workouts.push(workout);

    // Render workout on map as marker
    this._renderWorkoutMarker(workout);

    // Render workout on list
    this._renderWorkout(workout);

    // Hide the form and Clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();
  }

  _editWorkout(e) {
    if (!this.#isEdit) return;
    e.preventDefault();
    console.log(this.#editedWorkout);
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { coords } = this.#editedWorkout;
    const id = this.#editedWorkout.id;

    // Workout arrayinden sil
    // this.#workouts.slice(this.#editedWorkoutIndex, 1);

    if (type == 'running') {
      const cadence = +inputCadence.value;
      this.#editedWorkout = {};
      this.#editedWorkout = new Running(coords, distance, duration, cadence);
      this.#editedWorkout.id = id;
      this._toggleElevationField();
      // inputElevation.closest('.form__row').classList.add('form__row--hidden');
      // inputCadence.closest('.form__row').classList.remove('form__row--hidden');
    }

    if (type == 'cycling') {
      const elevationGain = +inputElevation.value;
      this.#editedWorkout = {};
      this.#editedWorkout = new Cycling(
        coords,
        distance,
        duration,
        elevationGain
      );
      this.#editedWorkout.id = id;
      this._toggleElevationField();
      // inputElevation
      //   .closest('.form__row')
      //   .classList.remove('form__row--hidden');
      // inputCadence.closest('.form__row').classList.add('form__row--hidden');
    }

    this.#workouts[this.#editedWorkoutIndex] = this.#editedWorkout;

    console.log(this.#workouts);
    // location.reload();

    // Render workouts and markers
    this._reRenderWorkouts();

    // Hide the form and Clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();
    this.#isEdit = false;
  }

  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords)
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
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();

    this.#markers.push(marker);
  }

  _reRenderWorkouts() {
    ////////// RE-RENDER ////////////
    // Clear rendered workouts from DOM
    containerWorkouts
      .querySelectorAll('.workout')
      .forEach(workout => workout.remove());

    this.#markers.forEach(marker => marker.remove());
    this.#markers = [];

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
      this._renderWorkoutMarker(work);
      console.log('render');
    });
    console.log(this.#workouts);
  }

  _renderWorkout(workout) {
    let html = `
    <li class="workout workout--${workout.type}" data-id="${workout.id}">
          <div class="menu menu__hidden">
            <ul class="menu__list ">
              <li class="menu__item menu__item--edit">Edit Form</li>
              <li class="menu__item menu__item--delete">Delete Item</li>
              <li class="menu__item menu__item--clear">Clear all</li>
            </ul>
          </div>
          <h2 class="workout__title">${workout.description}</h2>
          <div class="workout__details">
            <span class="workout__icon">${
              workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
            } </span>
            <span class="workout__value">${workout.distance}</span>
            <span class="workout__unit">km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <span class="workout__value">${workout.duration}</span>
            <span class="workout__unit">min</span>
          </div>
    `;

    if (workout.type === 'running') {
      html += ` 
    <div class="workout__details">
      <span class="workout__icon">⚡️</span>
      <span class="workout__value">${workout.pace.toFixed(1)}</span>
      <span class="workout__unit">min/km</span>
    </div>
    <div class="workout__details">
      <span class="workout__icon">🦶🏼</span>
      <span class="workout__value">${workout.cadence}</span>
      <span class="workout__unit">spm</span>
    </div>
    <button class="edit-button">...</button>
  </li>`;
    }

    if (workout.type === 'cycling') {
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
        <button class="edit-button">...</button>
      </li> 
  `;
    }
    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    // using the public interface
    // workout.click();
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    this.#workouts = data;
    console.log(data);

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  // Local storagetaki verileri silmek icin
  reset() {
    localStorage.removeItem('workouts');
    location.reload(); // Sayfayi reload etmek icin
  }
}

const app = new App();
