import React, { Component } from 'react';
import {
  Platform,
  PermissionsAndroid,
  View,
  Image
} from 'react-native';
import {Color} from 'common';
import Geolocation from '@react-native-community/geolocation';
import Geocoder from 'react-native-geocoding';
import { connect } from 'react-redux';
import MapView, {PROVIDER_GOOGLE} from 'react-native-maps';
import Style from './LocationWithMapStyles';
import Config from 'src/config.js'

class CurrentLocation extends Component {
  #region = {
    latitude: 0,
    longitude: 0,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
    formatted_address: null,
  };

  #location = {}

  constructor(props) {
    super(props)
    this.state = {}
  }

  componentDidMount() {
    this.#getCurrentLocation()
  }

  #requestPermission = async () => {

    if (Platform.OS === 'ios') {
      Geolocation.requestAuthorization();
      await this.#getCurrentLocation();
    } else {
      let granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'App Geolocation Permission',
          message: "App needs access to your phone's location.",
        },
      );

      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        await this.#getCurrentLocation();
      } else {
        console.log('Location permission not granted!!!!');
      }
    }
  };

  #getCurrentLocation = () => {
    Geocoder.init(Config.GOOGLE.API_KEY);
    const { data } = this.props.navigation.state.params
    this.#region = {
      ...this.#region,
      latitude: parseFloat(data.latitude),
      longitude:  parseFloat(data.longitude),
    },
    this.#onRegionChange(this.#region)
  }

  #onRegionChange = (regionUpdate) => {

    Geocoder.from(regionUpdate.latitude, regionUpdate.longitude)

      .then((json) => {
        var addressComponent = json.results[0].formatted_address.split(', ');
        let address = null;
        let route = null;
        let locality = null;
        let province = null;
        let region = null;
        let country = null;
        let latitude = null;
        let longitude = null;
        let postal = null;

        address = json.results[0].formatted_address;
        json.results[0].address_components.forEach(el => {
          if (el.types.includes('route')) {
            route = el.long_name;
          } else if (el.types.includes('locality')) {
            locality = el.long_name;
          } else if (el.types.includes('administrative_area_level_2')) {
            province = el.long_name;
          } else if (el.types.includes('administrative_area_level_1')) {
            region = el.long_name;
          } else if (el.types.includes('country')) {
            country = el.long_name;
          } else if (el.types.includes('postal_code')) {
            postal = el.long_name;
          }
        })

        longitude = json.results[0].geometry.location.lng;
        latitude = json.results[0].geometry.location.lat;

        this.#location = {
          route: route,
          address: address,
          province: province,
          locality: locality,
          region: region,
          country: country,
          postal: postal,
          latitude: latitude,
          longitude: longitude,
        };

        const { setLocation } = this.props
        setLocation(this.#location)

      }).catch((error) =>
        this.#location = error
      );

  };

  renderMap = () => {
    return (
      <View style={Style.container}
        pointerEvents="none"
      >
        <View
          style={{
            position: 'absolute',
            backgroundColor: Color.white,
            zIndex: 100,
            width: '100%',
          }}
        />

        <MapView
          style={Style.map}
          ref={(ref) => (this.mapView = ref)}
          provider={PROVIDER_GOOGLE}
          region={this.#region}
          draggable={false}
          // onPanDrag={this.setMapDragging}
          // onRegionChangeComplete={(e) => this.onRegionChange(e)}
        />

        <View style={Style.imageContainer}>
          <Image
            source={require('../../assets/userPosition.png')}
            style={Style.image}
          />
        </View>
      </View>
    );
  };

  render() {
    return (
      <View style={{ flex: 1 }}>
        {this.renderMap()}
      </View>
    )
  }
}
const mapStateToProps = (state) => ({ state: state });

const mapDispatchToProps = (dispatch) => {
  const { actions } = require('@redux');
  return {
    setLocation: (location) => dispatch(actions.setLocation(location))
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(CurrentLocation);