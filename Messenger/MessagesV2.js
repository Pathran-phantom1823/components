import React, { Component } from 'react';
import Style from './Style.js';
import {
  TextInput,
  View,
  Image,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  SafeAreaView,
  Dimensions,
  Alert
} from 'react-native';
import { Routes, Color, BasicStyles } from 'common';
import { Spinner, UserImage } from 'components';
import Api from 'services/api/index.js';
import { connect } from 'react-redux';
import Config from 'src/config.js';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faImage, faPaperPlane, faLock } from '@fortawesome/free-solid-svg-icons';
import ImageModal from 'components/Modal/ImageModal.js';
import ImagePicker from 'react-native-image-picker';
import CommonRequest from 'services/CommonRequest.js';

const DeviceHeight = Math.round(Dimensions.get('window').height);
const DeviceWidth = Math.round(Dimensions.get('window').width);

class MessagesV2 extends Component{
  constructor(props){
    super(props);
    this.state = {
      isLoading: false,
      selected: null,
      newMessage: null,
      imageModalUrl: null,
      isImageModal: false,
      photo: null,
      keyRefresh: 0,
      isPullingMessages: false,
      offset: 0,
      limit: 10,
      isLock: false
    }
  }

  componentDidMount(){
    const { user } = this.props.state
    if (user == null) return

    const { setMessengerGroup } = this.props
    const { navigation: { state: { params } } } = this.props
    const accountType = (user.account_type + '').toLowerCase()
    
    if (params.checkoutData != null) {
      if (accountType === 'rider') {
        const { id, code, merchantId, customerId } = params.checkoutData
        const parameter = {
          condition: [{
            column: 'title',
            clause: '=',
            value: code
          }],
          title: code,
          payload: id,
          creator: user.id,
          member: customerId,
          member2: merchantId,
        }
    
        this.setState({ isLoading: true })
        Api.request(Routes.messengerCreateForRider, parameter, response => {
          if (Array.isArray(response.data)) {
            setMessengerGroup(response.data[0])
          } else {
            setMessengerGroup({
              id: response.data,
              account_id: user.id
            })
          }
          this.retrieve();
        }, (error) => {
          this.setState({ isLoading: false })
          console.log({ messengerGroupRetrieveError: error })
        })
      }
      else if (accountType === 'user' || accountType === 'merchant') {
        const messengerTitle = params ? params.checkoutData.code : null
        const parameter = {
          condition: [{
            column: 'title',
            clause: '=',
            value: messengerTitle
          }]
        }
        
        this.setState({ isLoading: true })
        Api.request(Routes.messengerGroupRetrieve, parameter, response => {
          if (response.data.length > 0) {
            setMessengerGroup(response.data[0])
            this.retrieve();
          } else {
            this.createGroup(params, accountType)
          }
        }, (error) => {
          this.setState({ isLoading: false })
          console.log({ messengerGroupRetrieveError: error })
        })
      }
    }
    else if (params.depositData != null) {
      const messengerTitle = params ? params.depositData.code : null
      const parameter = {
        condition: [{
          column: 'title',
          clause: '=',
          value: messengerTitle
        }]
      }
      
      this.setState({ isLoading: true, isLock: false })
      Api.request(Routes.messengerGroupRetrieve, parameter, response => {
        if (response.data.length > 0) {
          setMessengerGroup(response.data[0])
          this.retrieve();
        } else {
          this.setState({ isLoading: false, isLock: true })
        }
      }, (error) => {
        this.setState({ isLoading: false })
        console.log({ messengerGroupRetrieveError: error })
      })
    }

  }

  componentWillUnmount() {
    const { setMessengerGroup, setMessagesOnGroup } = this.props
    setMessengerGroup(null)
    setMessagesOnGroup({
      groupId: null,
      messages: null
    })
  }

  retrieve = () => {
    const { offset, limit } = this.state
    const { messengerGroup } = this.props.state;
    const { setMessagesOnGroup } = this.props;

    this.setState({ isLoading: true });

    const parameter = {
      condition: [{
        value: messengerGroup.id,
        column: 'messenger_group_id',
        clause: '='
      }],
      sort: {
        'created_at': 'DESC'
      },
      limit,
      offset,
    }
    Api.request(Routes.messengerMessagesRetrieve, parameter, response => {
      this.setState({ isLoading: false, offset: offset + limit });
        setMessagesOnGroup({
        messages: response.data.reverse(),
        groupId: messengerGroup.id
      })
    }, error => {
      this.setState({ isLoading: false });
      console.log({ retrieveMessagesError: error })
    });
  }

  createGroup(params, accountType) {
    const { setMessengerGroup } = this.props
    const checkoutId = params ? params.checkoutData.id : null
    const merchantId = params ? params.checkoutData.merchantId : null
    const messengerTitle = params ? params.checkoutData.code : null

    const { user } = this.props.state

    if (!merchantId || !checkoutId || !user ) {
      this.setState({ isLoading: false })
      return
    }

    let parameter = {
      member: merchantId,
      creator: user.id,
      title: messengerTitle,
      payload: checkoutId
    }
    
    if (accountType === 'merchant') {
      const customerId = params ? params.checkoutData.customerId : null
      parameter = {
        member: customerId,
        creator: merchantId,
        title: messengerTitle,
        payload: checkoutId
      }
    }

    Api.request(Routes.customMessengerGroupCreate, parameter, response => {
      if (response.data) {
        setMessengerGroup({ id: response.data, account_id: user.id })
        this.retrieve()
      }
    }, error => {
      this.setState({ isLoading: false })
      console.log({ messenger_groups_error: error })
    })
  }

  retrieveMoreMessages = () => {
    const { offset, limit } = this.state
    const { messengerGroup, messagesOnGroup } = this.props.state;
    const { setMessagesOnGroup } = this.props;

    this.setState({ isLoading: true });

    const parameter = {
      condition: [{
        value: messengerGroup.id,
        column: 'messenger_group_id',
        clause: '='
      }],
      sort: {
        'created_at': 'DESC'
      },
      offset,
      limit,
    }

    Api.request(Routes.messengerMessagesRetrieve, parameter, response => {
      const newMessages = [...response.data.reverse(), ...messagesOnGroup.messages]
      this.setState({ isLoading: false, offset: offset + limit });
      setMessagesOnGroup({
        messages: newMessages,
        groupId: messengerGroup.id
      })
    }, error => {
      this.setState({ isLoading: false });
      console.log({ retrieveMoreMessagesError: error })
    });
  }

  retrieveGroup = (flag = null) => {
    const { user, messengerGroup } = this.props.state;
    const { setMessengerGroup } = this.props;
    if(messengerGroup == null || user == null){
      return
    }
    let parameter = {
      condition: [{
        value: messengerGroup.id,
        column: 'id',
        clause: '='
      }],
      account_id: user.id
    }
    CommonRequest.retrieveMessengerGroup(messengerGroup, user, response => {
      if(response.data != null){
        setMessengerGroup(response.data);
        setTimeout(() => {
          this.retrieve(response.data)
          this.setState({keyRefresh: this.state.keyRefresh + 1})
        }, 500)
      }
    })
  }

  sendNewMessage = () => {
    const { messengerGroup, user, messagesOnGroup} = this.props.state;
    const { updateMessagesOnGroup,  updateMessageByCode} = this.props;

    if(messengerGroup == null || user == null || this.state.newMessage == null){
      return
    }

    let parameter = {
      messenger_group_id: messengerGroup.id,
      message: this.state.newMessage,
      account_id: user.id,
      status: 0,
      payload: 'text',
      payload_value: null,
      code: messagesOnGroup.messages.length + 1
    }
    let newMessageTemp = {
      ...parameter,
      account: user,
      created_at_human: null,
      sending_flag: true,
      error: null
    }
    updateMessagesOnGroup(newMessageTemp);
    this.setState({newMessage: null})
    Api.request(Routes.messengerMessagesCreate, parameter, response => {
      if(response.data != null){
        updateMessageByCode(response.data);
      }
    });
  }

  sendImageWithoutPayload = (parameter) => {
    const { messengerGroup, user, messagesOnGroup } = this.props.state;
    const { updateMessageByCode } = this.props;

    Api.request(Routes.mmCreateWithImageWithoutPayload, parameter, response => {
      if(response.data != null){
        updateMessageByCode(response.data);
      }
    }, error => {
      console.log({ sendImageWithoutPayloadError: error })
    })
  }

  handleChoosePhoto = () => {
    const { user, messengerGroup, messagesOnGroup } = this.props.state;
    const options = {
      noData: true,
      error: null
    }
    ImagePicker.launchImageLibrary(options, response => {
      if (response.didCancel) {
        console.log('User cancelled image picker');
        this.setState({ photo: null })
      } else if (response.error) {
        console.log('ImagePicker Error: ', response.error);
        this.setState({ photo: null })
      } else if (response.customButton) {
        console.log('User tapped custom button: ', response.customButton);
        this.setState({ photo: null })
      }else {
        if(response.fileSize >= 1000000){
          Alert.alert('Notice', 'File size exceeded to 1MB')
          return
        }

        this.setState({ photo: response })
        const { updateMessagesOnGroup } = this.props;
        let formData = new FormData();
        let uri = Platform.OS == "android" ? response.uri : response.uri.replace("file://", "/private");
        formData.append("file", {
          name: response.fileName,
          type: response.type,
          uri: uri
        });
        formData.append('file_url', response.fileName);
        formData.append('account_id', user.id);

        let parameter = {
          messenger_group_id: messengerGroup.id,
          message: null,
          account_id: user.id,
          status: 0,
          payload: 'image',
          payload_value: null,
          url: uri,
          code: messagesOnGroup.messages.length + 1
        }
        let newMessageTemp = {
          ...parameter,
          account: user,
          created_at_human: null,
          sending_flag: true,
          files: [{
            url: uri
          }],
          error: null
        }
        updateMessagesOnGroup(newMessageTemp);

        Api.uploadByFetch(Routes.imageUploadUnLink, formData, imageResponse => {
          // add message
          if(imageResponse.data != null){
            parameter = {
              ...parameter,
              url: imageResponse.data
            }
            this.sendImageWithoutPayload(parameter)
          }
        }, error => {
          console.log({ imageError: error })
        })
      }
    })
  }

  setImage = (url) => {
    this.setState({imageModalUrl: url})
    setTimeout(() => {
      this.setState({isImageModal: true})
    }, 500)
  }


  updateValidation = (item, status) => {
    const { messengerGroup, user } = this.props.state;
    let parameter = {
      id: item.id,
      status: status,
      messages: {
        messenger_group_id: messengerGroup.id,
        account_id: user.id
      }
    }
    this.setState({isLoading: true})
    Api.request(Routes.requestValidationUpdate, parameter, response => {
      this.setState({isLoading: false})
      // this.retrieveGroup()
    })
  }

  _image = (item) => {
    const { messengerGroup, user, theme } = this.props.state;
    return (
      <View>
      {
        item.payload_value != null && Platform.OS == 'android' && (
          <Text style={[Style.messageTextRight, {
            backgroundColor: item.validations.status == 'approved' ? Color.primary : Color.danger
          }]}>{item.validations.payload} - {item.validations.status}</Text>
        )
      }
      {
        item.payload_value != null && Platform.OS == 'ios' && (
          <View style={[Style.messageTextRight, {
            backgroundColor: item.validations.status == 'approved' ? Color.primary : Color.danger
          }]}>
            <Text style={Style.messageTextRightIOS}>
              {item.validations.payload} - {item.validations.status}
            </Text>
          </View>
        )
      }
        <View style={{
          flexDirection: 'row',
          marginTop: 10
        }}>
          {
            item.files.map((imageItem, imageIndex) => {
              return (
                <TouchableOpacity
                  onPress={() => this.setImage(Config.BACKEND_URL  + imageItem.url)} 
                  style={Style.messageImage}
                  key={imageIndex}
                  >
                  {
                    item.sending_flag == true && (
                      <Image source={{uri: imageItem.url}} style={Style.messageImage} key={imageIndex}/>
                    )
                  }
                  {
                    item.sending_flag != true && (
                      <Image source={{uri: Config.BACKEND_URL  + imageItem.url}} style={Style.messageImage} key={imageIndex}/>
                    )
                  }
                  
                </TouchableOpacity>
              );
            })
          }
        </View>
        {
          messengerGroup.account_id == user.id &&
          item != null && item.validations != null &&
          item.validations.status != 'approved' &&
          (
            <View style={{
              flexDirection: 'row',
              marginTop: 10
            }}>
              <View style={{
                  width: '45%',
                  height: 50,
                  marginRight: '5%'
                }}>
                <TouchableOpacity
                  onPress={() => {
                    this.updateValidation(item.validations, 'declined')
                  }} 
                  style={[Style.templateBtn, {
                    width: '100%',
                    height: 40,
                    borderColor: Color.danger
                  }]}
                  >
                  <Text style={[Style.templateText, {
                    color: Color.danger
                  }]}>Decline</Text>
                </TouchableOpacity>
              </View>
              <View style={{
                  width: '45%',
                  height: 50,
                  marginRight: '5%'
                }}>
                <TouchableOpacity
                  onPress={() => {
                    this.updateValidation(item.validations, 'approved')
                  }} 
                  style={[Style.templateBtn, {
                    width: '100%',
                    height: 40,
                    borderColor: theme ? theme.primary : Color.primary
                  }]}
                  >
                  <Text style={[Style.templateText, {
                    color: theme ? theme.primary : Color.primary
                  }]}>Approve</Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        }
      </View>
    );
  }

  _imageTest = (item) => {
    return (
      <View style={{
        flexDirection: 'row' 
      }}>
        <TouchableOpacity
          onPress={() => this.setImage(item.uri)} 
          style={Style.messageImage}
          >
          <Image source={{uri: item.uri}} style={Style.messageImage}/>
        </TouchableOpacity>
      </View>
    );
  }

  _headerRight = (item) => {
    return (
      <View style={{flexDirection: 'row', marginTop: 10}}>
        <UserImage user={item.account}/>
        <Text style={{
          lineHeight: 30,
          paddingLeft: 10
        }}>{item.account.username}</Text>
      </View>
    );
  }

  _headerLeft = (item) => {
    return (
      <View style={{flexDirection: 'row', marginTop: 10, justifyContent: 'flex-end' }}>
        <Text style={{
          lineHeight: 30,
          paddingRight: 10
        }}>{item.account.username}</Text>
        <UserImage user={item.account}/>
      </View>
    );
  }

  _rightTemplate = (item) => {
    const { theme } = this.props.state;
    return (
      <View>
        {this._headerRight(item)}
        <Text style={[Style.dateText, {
          textAlign: 'left'
        }]}>{item.created_at_human}</Text>
        {
          item.message != null && Platform.OS == 'android' && (
            <Text style={[Style.messageTextRight, {
              backgroundColor: theme ? theme.primary : Color.primary
            }]}>{item.message}</Text>
          )
        }
        {
          item.message != null && Platform.OS == 'ios' && (
            <View style={[Style.messageTextRight, {
              backgroundColor: theme ? theme.primary : Color.primary
            }]}>
                <Text style={Style.messageTextRightIOS}>{item.message}</Text>
            </View>
          )
        }
        {
          item.payload == 'image' && (this._image(item))
        }
      </View>
    );
  }

  _leftTemplate = (item) => {
    const { theme } = this.props.state;
    return (
      <View>
        {this._headerLeft(item)}
        <Text style={[Style.dateText, {
          textAlign: 'right'
        }]}>{item.created_at_human}</Text>
        {
          item.message != null && Platform.OS == 'android' && (
            <Text style={[Style.messageTextLeft, {
              backgroundColor: theme ? theme.primary : Color.primary
            }]}>{item.message}</Text>
          )
        }
        {
          item.message != null && Platform.OS == 'ios' && (
            <View style={[Style.messageTextLeft, {
              backgroundColor: theme ? theme.primary : Color.primary
            }]}>
                <Text style={Style.messageTextLeftIOS}>{item.message}</Text>
            </View>
          )
        }
        {
          item.payload == 'image' && (this._image(item))
        }
        {
          item.sending_flag == true && (
            <Text style={{
              fontSize: 10,
              color: Color.gray,
              textAlign: 'right' 
            }}>Sending...</Text>
          )
        }
      </View>
    );
  }

  _conversations = (item, index) => {
    const { user, messagesOnGroup } = this.props.state;
    return (
      <View style={{
        width: '100%',
        marginBottom: index == (messagesOnGroup.messages.length - 1) ? 50: 0
      }}>
        <View style={{
          alignItems: 'flex-end'
        }}>
          {item.account_id == user.id && (this._leftTemplate(item))}
        </View>
        <View style={{
          alignItems: 'flex-start' 
        }}>
          {item.account_id != user.id && (this._rightTemplate(item))}
        </View>
      </View>
    );
  }

  _footer = () => {
    const { theme } = this.props.state;
    return (
      <View style={{
        flexDirection: 'row' 
      }}>
        <TouchableOpacity
          onPress={() => this.handleChoosePhoto()} 
          style={{
            height: 50,
            justifyContent: 'center',
            alignItems: 'center',
            width: '10%'
          }}
          >
          <FontAwesomeIcon
            icon={ faImage }
            size={BasicStyles.iconSize}
            style={{
              color: theme ? theme.primary : Color.primary
            }}
            />
        </TouchableOpacity>
        <TextInput
          style={Style.formControl}
          onChangeText={(newMessage) => this.setState({newMessage})}
          value={this.state.newMessage}
          placeholder={'Type your message here ...'}
        />
        <TouchableOpacity
          onPress={() => this.sendNewMessage()} 
          style={{
            height: 50,
            justifyContent: 'center',
            alignItems: 'center',
            width: '10%'
          }}
          >
          <FontAwesomeIcon
            icon={ faPaperPlane }
            size={BasicStyles.iconSize}
            style={{
              color: theme ? theme.primary : Color.primary
            }}
            />
        </TouchableOpacity>
      </View>
    );
  }

  _flatList = () => {
    const { selected } = this.state;
    const { user, messagesOnGroup, messengerGroup } = this.props.state;
    return (
      <View style={{
        width: '100%',
        height: '100%'
      }}>
        {
          messagesOnGroup != null && messagesOnGroup.messages != null && user != null && (
            <FlatList
              data={messagesOnGroup.messages}
              extraData={this.props}
              ItemSeparatorComponent={this.FlatListItemSeparator}
              style={{
                marginBottom: 50,
                flex: 1,
                
              }}
              renderItem={({ item, index }) => (
                <View>
                  {this._conversations(item, index)}
                </View>
              )}
              keyExtractor={(item, index) => index.toString()}
            />
          )
        }
      </View>
    );
  }

  render() {
    const { 
      isLoading,
      isImageModal,
      imageModalUrl,
      photo,
      keyRefresh,
      isPullingMessages,
      isLock
    } = this.state;
    const { messengerGroup, user } = this.props.state;
    return (
      <SafeAreaView>
        {
          // ON DEPOSITS (IF CONVERSATION IS NOT YET AVAILABLE)
          isLock && (
            <View style={{
              height: DeviceHeight - 150,
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <FontAwesomeIcon
                icon={faLock}
                size={DeviceWidth * 0.20}
                style={{ color: Color.black, marginBottom: 10 }}
              />
              <Text style={{ color: Color.darkGray, fontSize: 13 }}>
                Conversation is not yet available, try again later
              </Text>
            </View>
          )
        }
        <KeyboardAvoidingView
          behavior={'padding'} 
          keyboardVerticalOffset={
            Platform.select({
              ios: () => 65,
              android: () => -200
          })()}
        >
          <View key={keyRefresh}>
            {isLoading ? <Spinner mode="full"/> : null }
            <ScrollView
              ref={ref => this.scrollView = ref}
              onContentSizeChange={(contentWidth, contentHeight)=>{        
                if (!isPullingMessages) {
                  this.scrollView.scrollToEnd({animated: true});
                }
              }}
              style={[Style.ScrollView, {
                height: '100%'
              }]}
              onScroll={({ nativeEvent }) => {
                const { layoutMeasurement, contentOffset, contentSize } = nativeEvent
                const isOnBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height
                const isOnTop = contentOffset.y <= 0

                if (isOnTop) {
                  if(this.state.isLoading == false){
                    if (!isPullingMessages) {
                      this.setState({ isPullingMessages: true })
                    }
                    this.retrieveMoreMessages()
                  }
                }
                if (isOnBottom) {
                  if (this.state.isLoading == false && isPullingMessages) {
                    this.setState({ isPullingMessages: false })
                  }
                }
              }}
              >
              <View style={{
                flexDirection: 'row',
                width: '100%'
              }}>
                {this._flatList()}
              </View>
            </ScrollView>
            <View style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              borderTopColor: Color.lightGray,
              borderTopWidth: 1,
              backgroundColor: Color.white
            }}>
              {messengerGroup != null && (this._footer())}
            </View>
            <ImageModal
              visible={isImageModal}
              url={imageModalUrl}
              action={() => this.setState({isImageModal: false})}
            ></ImageModal>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }
}
const mapStateToProps = state => ({ state: state });

const mapDispatchToProps = dispatch => {
  const { actions } = require('@redux');
  return {
    setMessagesOnGroup: (messagesOnGroup) => dispatch(actions.setMessagesOnGroup(messagesOnGroup)),
    setMessengerGroup: (messengerGroup) => dispatch(actions.setMessengerGroup(messengerGroup)),
    updateMessagesOnGroup: (message) => dispatch(actions.updateMessagesOnGroup(message)),
    updateMessageByCode: (message) => dispatch(actions.updateMessageByCode(message)),
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(MessagesV2);
