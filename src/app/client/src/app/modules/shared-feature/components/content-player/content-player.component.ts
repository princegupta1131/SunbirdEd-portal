import { ActivatedRoute } from '@angular/router';
import { Component, OnInit, AfterViewInit, OnDestroy, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { UserService, PlayerService, CopyContentService, PermissionService } from '@sunbird/core';
import * as _ from 'lodash-es';
import {
  ConfigService, ResourceService, ToasterService, WindowScrollService, NavigationHelperService,
  PlayerConfig, ContentData, ContentUtilsServiceService, ITelemetryShare, LayoutService
} from '@sunbird/shared';
import { IInteractEventObject, IInteractEventEdata, IImpressionEventInput, TelemetryService } from '@sunbird/telemetry';
import { PopupControlService } from '../../../../service/popup-control.service';
import { takeUntil, mergeMap } from 'rxjs/operators';
import { Subject, of, throwError } from 'rxjs';
import { PublicPlayerService, ComponentCanDeactivate } from '@sunbird/public';
import { CsGroupAddableBloc } from '@project-sunbird/client-services/blocs';

@Component({
  selector: 'app-content-player',
  templateUrl: './content-player.component.html',
  styleUrls: ['./content-player.component.scss']
})

export class ContentPlayerComponent implements OnInit, AfterViewInit, OnDestroy, ComponentCanDeactivate {
  telemetryImpression: IImpressionEventInput;
  objectInteract: IInteractEventObject;
  copyContentInteractEdata: IInteractEventEdata;
  sharelinkModal: boolean;
  shareLink: string;
  contentId: string;
  contentStatus: string;
  playerConfig: PlayerConfig;
  showPlayer = false;
  showError = false;
  errorMessage: string;
  contentData: ContentData;
  telemetryShareData: Array<ITelemetryShare>;
  public pageLoadDuration: Number;
  playerOption: any;
  showLoader = true;
  isFullScreenView = false;
  layoutConfiguration;
  public unsubscribe = new Subject<void>();
  public dialCode: string;
  public unsubscribe$ = new Subject<void>();
  public objectRollup = {};
  isGroupAdmin: boolean;
  groupId: string;
  isQuestionSet = false;
  isDesktopApp = false;
  isTypeCopyQuestionset:boolean = false;

  @HostListener('window:beforeunload')
    canDeactivate() {
      // returning true will navigate without confirmation
      // returning false will show a confirm dialog before navigating away
      const deviceType = this.telemetryService.getDeviceType();
      return deviceType === 'Desktop' && this.isQuestionSet && !this.isTypeCopyQuestionset ? false : true;
    }

  constructor(public activatedRoute: ActivatedRoute, public navigationHelperService: NavigationHelperService,
    public userService: UserService, public resourceService: ResourceService, public router: Router,
    public toasterService: ToasterService, public windowScrollService: WindowScrollService,
    public playerService: PlayerService, public publicPlayerService: PublicPlayerService,
    public copyContentService: CopyContentService, public permissionService: PermissionService,
    public contentUtilsServiceService: ContentUtilsServiceService, public popupControlService: PopupControlService,
    private configService: ConfigService,
    public layoutService: LayoutService, public telemetryService: TelemetryService) {
    this.playerOption = {
      showContentRating: true
    };
  }

  ngOnInit() {
    console.log('content');
    this.isQuestionSet = _.includes(this.router.url, 'questionset');
    this.isDesktopApp = this.userService.isDesktopApp;
    this.initLayout();
    this.activatedRoute.params.subscribe((params) => {
      this.showPlayer = false;
      this.contentId = params.contentId;
      this.contentStatus = params.contentStatus;
      this.dialCode = _.get(this.activatedRoute, 'snapshot.queryParams.dialCode');
      if (_.get(this.activatedRoute, 'snapshot.queryParams.l1Parent')) {
        this.objectRollup = {
          l1: _.get(this.activatedRoute, 'snapshot.queryParams.l1Parent')
        };
      }
      CsGroupAddableBloc.instance.state$.pipe(takeUntil(this.unsubscribe$)).subscribe(data => {
        this.groupId = _.get(data, 'groupId') || _.get(this.activatedRoute.snapshot, 'queryParams.groupId');
      });
      this.getContent();
      CsGroupAddableBloc.instance.state$.pipe(takeUntil(this.unsubscribe$)).subscribe(data => {
        this.isGroupAdmin = !_.isEmpty(_.get(this.activatedRoute.snapshot, 'queryParams.groupId'))
        && _.get(data.params, 'groupData.isAdmin');
      });
    });

    this.navigationHelperService.contentFullScreenEvent.
      pipe(takeUntil(this.unsubscribe)).subscribe(isFullScreen => {
        this.isFullScreenView = isFullScreen;
      });
  }

  initLayout() {
    this.layoutConfiguration = this.layoutService.initlayoutConfig();
    this.layoutService.switchableLayout().
      pipe(takeUntil(this.unsubscribe)).subscribe(layoutConfig => {
        if (layoutConfig != null) {
          this.layoutConfiguration = layoutConfig.layout;
        }
      });
  }

  setTelemetryData() {
    this.telemetryImpression = {
      context: {
        env: this.activatedRoute.snapshot.data.telemetry.env,
        cdata: this.groupId ? [{id: this.groupId, type: 'Group'}] : [],
      },
      object: {
        id: this.contentId,
        type: this.contentData.contentType,
        ver: this.contentData.pkgVersion ? this.contentData.pkgVersion.toString() : '1.0'
      },
      edata: {
        type: this.activatedRoute.snapshot.data.telemetry.type,
        pageid: this.activatedRoute.snapshot.data.telemetry.pageid,
        uri: this.router.url,
        subtype: this.activatedRoute.snapshot.data.telemetry.subtype,
        duration: this.pageLoadDuration
      }
    };
    this.objectInteract = {
      id: this.contentId,
      type: this.contentData.contentType,
      ver: this.contentData.pkgVersion ? this.contentData.pkgVersion.toString() : '1.0'
    };
    this.copyContentInteractEdata = {
      id: 'copy-content-button',
      type: 'click',
      pageid: this.activatedRoute.snapshot.data.telemetry.pageid
    };
  }

  goBack() {
    this.navigationHelperService.goBack();
  }

  getContent() {
    if (this.isQuestionSet) {
      this.getQuestionSetHierarchy();
    } else if (this.userService.loggedIn) {
      const option = { params: this.configService.appConfig.ContentPlayer.contentApiQueryParams };
      if (this.contentStatus && this.contentStatus === 'Unlisted') {
        option.params = { mode: 'edit' };
      }
      this.playerService.getContent(this.contentId, option).subscribe(
        (response) => {
        //   let response = {
        //     "id": "api.course.hierarchy",
        //     "ver": "1.0",
        //     "ts": "2023-10-11T06:34:48.560Z",
        //     "params": {
        //         "resmsgid": "46686700-6800-11ee-af4c-9bc8d99a1601",
        //         "msgid": "6109bc1b-958d-46ab-b3c6-5a5a4641daec",
        //         "status": "successful",
        //         "err": null,
        //         "errmsg": null
        //     },
        //     "responseCode": "OK",
        //     "result": {
        //         "content": {
        //             "ownershipType": [
        //                 "createdBy"
        //             ],
        //             "publish_type": "public",
        //             "se_gradeLevelIds": [
        //                 "ncf_gradelevel_grade1"
        //             ],
        //             "keywords": [],
        //             "targetMediumIds": [
        //                 "ncf_medium_telugu"
        //             ],
        //             "channel": "0137541424673095687",
        //             "downloadUrl": "https://sunbirddev.blob.core.windows.net/sunbird-content-dev/content/do_113788048780771328112/rajcourse001_1683111611570_do_113788048780771328112_1_SPINE.ecar",
        //             "organisation": [],
        //             "language": [
        //                 "English"
        //             ],
        //             "mimeType": "application/vnd.ekstep.content-collection",
        //             "variants": "{\"spine\":{\"ecarUrl\":\"https://sunbirddev.blob.core.windows.net/sunbird-content-dev/content/do_113788048780771328112/rajcourse001_1683111611570_do_113788048780771328112_1_SPINE.ecar\",\"size\":\"10458\"},\"online\":{\"ecarUrl\":\"https://sunbirddev.blob.core.windows.net/sunbird-content-dev/content/do_113788048780771328112/rajcourse001_1683111612008_do_113788048780771328112_1_ONLINE.ecar\",\"size\":\"5875\"}}",
        //             "body": null,
        //             "leafNodes": [
        //                 "do_113762457386450944167",
        //                 "do_113762457976889344169",
        //                 "do_113762457691021312168"
        //             ],
        //             "targetGradeLevelIds": [
        //                 "ncf_gradelevel_grade1"
        //             ],
        //             "objectType": "Content",
        //             "commercialcrops": [
        //                 "pastures"
        //             ],
        //             "appIcon": "",
        //             "children": [
        //                 {
        //                     "lastStatusChangedOn": "2023-05-03T10:57:58.197+0000",
        //                     "parent": "do_113788048780771328112",
        //                     "children": [
        //                         {
        //                             "copyright": "Sunbird Org",
        //                             "lastStatusChangedOn": "2023-03-28T07:14:31.184+0000",
        //                             "parent": "do_113788049229389824113",
        //                             "organisation": [
        //                                 "Sunbird Org"
        //                             ],
        //                             "mediaType": "content",
        //                             "name": "Content - 3",
        //                             "discussionForum": "{\"enabled\":\"No\"}",
        //                             "createdOn": "2023-03-28T07:12:26.011+0000",
        //                             "createdFor": [
        //                                 "0137541424673095687"
        //                             ],
        //                             "channel": "0137541424673095687",
        //                             "lastUpdatedOn": "2023-03-28T07:44:20.523+0000",
        //                             "subject": [
        //                                 "Telugu"
        //                             ],
        //                             "size": 13992641,
        //                             "streamingUrl": "https://sunbirdspikemedia-inct.streaming.media.azure.net/cdcfd08e-c2b4-4dc8-9608-bbd66fa10203/mp4_14.ism/manifest(format=m3u8-aapl-v3)",
        //                             "identifier": "do_113762457976889344169",
        //                             "resourceType": "Learn",
        //                             "livestockmanagement": [
        //                                 "feedingandnutrition",
        //                                 "geneticsandselection"
        //                             ],
        //                             "ownershipType": [
        //                                 "createdBy"
        //                             ],
        //                             "compatibilityLevel": 1,
        //                             "audience": [
        //                                 "Student"
        //                             ],
        //                             "foodcrops": [
        //                                 "Other"
        //                             ],
        //                             "os": [
        //                                 "All"
        //                             ],
        //                             "primaryCategory": "Explanation Content",
        //                             "appIcon": "https://sunbirddev.blob.core.windows.net/sunbird-content-dev/content/do_113762457976889344169/artifact/do_11376182181755289617_1679909890013_logo-test.thumb.png",
        //                             "commercialcrops": [
        //                                 "pastures"
        //                             ],
        //                             "downloadUrl": "https://sunbirddev.blob.core.windows.net/sunbird-content-dev/content/do_113762457976889344169/content-3_1679987669566_do_113762457976889344169_1.ecar",
        //                             "livestockmanagements": [
        //                                 "feedingandnutrition"
        //                             ],
        //                             "lockKey": "110c8e7d-1dbc-4deb-b56c-eee31217f463",
        //                             "commercialcropss": [
        //                                 "pastures"
        //                             ],
        //                             "framework": "NCF",
        //                             "posterImage": "https://sunbirddev.blob.core.windows.net/sunbird-content-dev/content/do_11376182181755289617/artifact/do_11376182181755289617_1679909890013_logo-test.png",
        //                             "creator": "contentCreator Creator",
        //                             "versionKey": "1679989460523",
        //                             "mimeType": "video/mp4",
        //                             "code": "d325130c-2846-4520-a0d3-6c655a7a14c7",
        //                             "license": "CC BY 4.0",
        //                             "version": 2,
        //                             "prevStatus": "Processing",
        //                             "contentType": "Resource",
        //                             "prevState": "Review",
        //                             "language": [
        //                                 "English"
        //                             ],
        //                             "foodcropss": "Other",
        //                             "lastPublishedOn": "2023-03-28T07:14:29.213+0000",
        //                             "objectType": "Content",
        //                             "lastUpdatedBy": "155ce3c5-713e-4749-bc1c-95d09c640914",
        //                             "status": "Live",
        //                             "createdBy": "155ce3c5-713e-4749-bc1c-95d09c640914",
        //                             "dialcodeRequired": "No",
        //                             "lastSubmittedOn": "2023-03-28T07:12:47.331+0000",
        //                             "interceptionPoints": "{}",
        //                             "idealScreenSize": "normal",
        //                             "contentEncoding": "identity",
        //                             "depth": 2,
        //                             "lastPublishedBy": "469dc732-04f3-42d9-9a85-30957a797acc",
        //                             "livestockspecies": [
        //                                 "bees"
        //                             ],
        //                             "osId": "org.ekstep.quiz.app",
        //                             "se_FWIds": [
        //                                 "NCF"
        //                             ],
        //                             "contentDisposition": "inline",
        //                             "previewUrl": "https://sunbirddev.blob.core.windows.net/sunbird-content-dev/content/assets/do_113762457976889344169/mp4_14.mp4",
        //                             "artifactUrl": "https://sunbirddev.blob.core.windows.net/sunbird-content-dev/content/assets/do_113762457976889344169/mp4_14.mp4",
        //                             "visibility": "Default",
        //                             "credentials": "{\"enabled\":\"No\"}",
        //                             "variants": "{\"full\":{\"ecarUrl\":\"https://sunbirddev.blob.core.windows.net/sunbird-content-dev/content/do_113762457976889344169/content-3_1679987669566_do_113762457976889344169_1.ecar\",\"size\":\"13809410\"},\"spine\":{\"ecarUrl\":\"https://sunbirddev.blob.core.windows.net/sunbird-content-dev/content/do_113762457976889344169/content-3_1679987670981_do_113762457976889344169_1_SPINE.ecar\",\"size\":\"2039\"}}",
        //                             "index": 1,
        //                             "pkgVersion": 1,
        //                             "idealScreenDensity": "hdpi"
        //                         },
        //                         {
        //                             "copyright": "Sunbird Org",
        //                             "lastStatusChangedOn": "2023-03-28T07:14:10.380+0000",
        //                             "parent": "do_113788049229389824113",
        //                             "organisation": [
        //                                 "Sunbird Org"
        //                             ],
        //                             "mediaType": "content",
        //                             "name": "Content -1",
        //                             "discussionForum": "{\"enabled\":\"No\"}",
        //                             "createdOn": "2023-03-28T07:11:13.936+0000",
        //                             "createdFor": [
        //                                 "0137541424673095687"
        //                             ],
        //                             "channel": "0137541424673095687",
        //                             "lastUpdatedOn": "2023-03-28T07:44:18.230+0000",
        //                             "subject": [
        //                                 "Telugu"
        //                             ],
        //                             "size": 2523606,
        //                             "streamingUrl": "https://sunbirdspikemedia-inct.streaming.media.azure.net/a8e9ea76-cb46-4f65-8901-599e3d5aca90/poem.ism/manifest(format=m3u8-aapl-v3)",
        //                             "identifier": "do_113762457386450944167",
        //                             "resourceType": "Learn",
        //                             "livestockmanagement": [
        //                                 "geneticsandselection",
                                       
        //                             ],
        //                             "ownershipType": [
        //                                 "createdBy"
        //                             ],
        //                             "compatibilityLevel": 1,
        //                             "audience": [
        //                                 "Student"
        //                             ],
        //                             "foodcrops": [
        //                                 "grains"
        //                             ],
        //                             "os": [
        //                                 "All"
        //                             ],
        //                             "primaryCategory": "Explanation Content",
        //                             "appIcon": "https://sunbirddev.blob.core.windows.net/sunbird-content-dev/content/do_113762457386450944167/artifact/do_11376182181755289617_1679909890013_logo-test.thumb.png",
        //                             "commercialcrops": [
        //                                 "crops"
        //                             ],
        //                             "downloadUrl": "https://sunbirddev.blob.core.windows.net/sunbird-content-dev/content/do_113762457386450944167/content-1_1679987649315_do_113762457386450944167_1.ecar",
        //                             "livestockspecies": [
        //                                 "bees"
        //                             ],
        //                             "lockKey": "aaa610be-af98-4607-b665-ed416056107c",
        //                             "commercialcropss": [
        //                                 "pastures"
        //                             ],
        //                             "framework": "NCF",
        //                             "posterImage": "https://sunbirddev.blob.core.windows.net/sunbird-content-dev/content/do_11376182181755289617/artifact/do_11376182181755289617_1679909890013_logo-test.png",
        //                             "creator": "contentCreator Creator",
        //                             "versionKey": "1679989458230",
        //                             "mimeType": "video/mp4",
        //                             "code": "6187c892-3ba2-49e1-a192-15bc328e65eb",
        //                             "license": "CC BY 4.0",
        //                             "version": 2,
        //                             "prevStatus": "Processing",
        //                             "contentType": "Resource",
        //                             "prevState": "Review",
        //                             "language": [
        //                                 "English"
        //                             ],
        //                             "foodcropss": "Other",
        //                             "lastPublishedOn": "2023-03-28T07:14:09.017+0000",
        //                             "objectType": "Content",
        //                             "lastUpdatedBy": "155ce3c5-713e-4749-bc1c-95d09c640914",
        //                             "status": "Live",
        //                             "createdBy": "155ce3c5-713e-4749-bc1c-95d09c640914",
        //                             "dialcodeRequired": "No",
        //                             "lastSubmittedOn": "2023-03-28T07:11:33.229+0000",
        //                             "interceptionPoints": "{}",
        //                             "idealScreenSize": "normal",
        //                             "contentEncoding": "identity",
        //                             "depth": 2,
        //                             "lastPublishedBy": "469dc732-04f3-42d9-9a85-30957a797acc",
        //                             "livestockmanagements": [
        //                                 "feedingandnutrition"
        //                             ],
        //                             "osId": "org.ekstep.quiz.app",
        //                             "se_FWIds": [
        //                                 "NCF"
        //                             ],
        //                             "contentDisposition": "inline",
        //                             "previewUrl": "https://sunbirddev.blob.core.windows.net/sunbird-content-dev/content/assets/do_113762457386450944167/poem.mp4",
        //                             "artifactUrl": "https://sunbirddev.blob.core.windows.net/sunbird-content-dev/content/assets/do_113762457386450944167/poem.mp4",
        //                             "visibility": "Default",
        //                             "credentials": "{\"enabled\":\"No\"}",
        //                             "variants": "{\"full\":{\"ecarUrl\":\"https://sunbirddev.blob.core.windows.net/sunbird-content-dev/content/do_113762457386450944167/content-1_1679987649315_do_113762457386450944167_1.ecar\",\"size\":\"2492085\"},\"spine\":{\"ecarUrl\":\"https://sunbirddev.blob.core.windows.net/sunbird-content-dev/content/do_113762457386450944167/content-1_1679987650089_do_113762457386450944167_1_SPINE.ecar\",\"size\":\"2030\"}}",
        //                             "index": 2,
        //                             "pkgVersion": 1,
        //                             "idealScreenDensity": "hdpi"
        //                         },
        //                         {
        //                             "copyright": "Sunbird Org",
        //                             "lastStatusChangedOn": "2023-03-28T07:14:21.098+0000",
        //                             "parent": "do_113788049229389824113",
        //                             "organisation": [
        //                                 "Sunbird Org"
        //                             ],
        //                             "mediaType": "content",
        //                             "name": "Content - 2",
        //                             "discussionForum": "{\"enabled\":\"No\"}",
        //                             "createdOn": "2023-03-28T07:11:51.115+0000",
        //                             "createdFor": [
        //                                 "0137541424673095687"
        //                             ],
        //                             "channel": "0137541424673095687",
        //                             "lastUpdatedOn": "2023-03-28T07:44:16.190+0000",
        //                             "category5": "Category5 Term1",
        //                             "size": 1055736,
        //                             "streamingUrl": "https://sunbirdspikemedia-inct.streaming.media.azure.net/5d2643e3-fcae-42a8-8a22-ac291a317ed4/samplevideo_1280x720_1mb.ism/manifest(format=m3u8-aapl-v3)",
        //                             "identifier": "do_113762457691021312168",
        //                             "resourceType": "Learn",
        //                             "ownershipType": [
        //                                 "createdBy"
        //                             ],
        //                             "category2": "Category2 Term1",
        //                             "compatibilityLevel": 1,
        //                             "audience": [
        //                                 "Student"
        //                             ],
        //                             "os": [
        //                                 "All"
        //                             ],
        //                             "primaryCategory": "Explanation Content",
        //                             "appIcon": "https://sunbirddev.blob.core.windows.net/sunbird-content-dev/content/do_113762457691021312168/artifact/do_11376182453272576019_1679910221428_287-2876925_test-image-png-unit-testing-png-transparent-png.thumb.png",
        //                             "downloadUrl": "https://sunbirddev.blob.core.windows.net/sunbird-content-dev/content/do_113762457691021312168/content-2_1679987660391_do_113762457691021312168_1.ecar",
        //                             "lockKey": "1a558750-41dd-43d3-9d4f-9f12184a902e",
        //                             "framework": "framework1",
        //                             "posterImage": "https://sunbirddev.blob.core.windows.net/sunbird-content-dev/content/do_11376182453272576019/artifact/do_11376182453272576019_1679910221428_287-2876925_test-image-png-unit-testing-png-transparent-png.png",
        //                             "creator": "contentCreator Creator",
        //                             "category1": "Category1 Term1",
        //                             "versionKey": "1679989456190",
        //                             "mimeType": "video/mp4",
        //                             "code": "62ada120-13c4-4e94-aad6-56cebe6a089c",
        //                             "license": "CC BY 4.0",
        //                             "version": 2,
        //                             "prevStatus": "Processing",
        //                             "contentType": "Resource",
        //                             "prevState": "Review",
        //                             "language": [
        //                                 "English"
        //                             ],
        //                             "lastPublishedOn": "2023-03-28T07:14:20.009+0000",
        //                             "objectType": "Content",
        //                             "lastUpdatedBy": "155ce3c5-713e-4749-bc1c-95d09c640914",
        //                             "status": "Live",
        //                             "createdBy": "155ce3c5-713e-4749-bc1c-95d09c640914",
        //                             "dialcodeRequired": "No",
        //                             "lastSubmittedOn": "2023-03-28T07:12:10.623+0000",
        //                             "interceptionPoints": "{}",
        //                             "category3": "Category3 Term1",
        //                             "idealScreenSize": "normal",
        //                             "contentEncoding": "identity",
        //                             "depth": 2,
        //                             "lastPublishedBy": "469dc732-04f3-42d9-9a85-30957a797acc",
        //                             "osId": "org.ekstep.quiz.app",
        //                             "se_FWIds": [
        //                                 "NCF"
        //                             ],
        //                             "contentDisposition": "inline",
        //                             "previewUrl": "https://sunbirddev.blob.core.windows.net/sunbird-content-dev/content/assets/do_113762457691021312168/samplevideo_1280x720_1mb.mp4",
        //                             "artifactUrl": "https://sunbirddev.blob.core.windows.net/sunbird-content-dev/content/assets/do_113762457691021312168/samplevideo_1280x720_1mb.mp4",
        //                             "visibility": "Default",
        //                             "credentials": "{\"enabled\":\"No\"}",
        //                             "variants": "{\"full\":{\"ecarUrl\":\"https://sunbirddev.blob.core.windows.net/sunbird-content-dev/content/do_113762457691021312168/content-2_1679987660391_do_113762457691021312168_1.ecar\",\"size\":\"1058720\"},\"spine\":{\"ecarUrl\":\"https://sunbirddev.blob.core.windows.net/sunbird-content-dev/content/do_113762457691021312168/content-2_1679987660892_do_113762457691021312168_1_SPINE.ecar\",\"size\":\"4153\"}}",
        //                             "index": 3,
        //                             "pkgVersion": 1,
        //                             "idealScreenDensity": "hdpi",
        //                             "category4": "Category4 Term1"
        //                         }
        //                     ],
        //                     "mediaType": "content",
        //                     "name": "Course Unit1",
        //                     "discussionForum": {
        //                         "enabled": "No"
        //                     },
        //                     "createdOn": "2023-05-03T10:57:58.197+0000",
        //                     "channel": "0137541424673095687",
        //                     "generateDIALCodes": "No",
        //                     "lastUpdatedOn": "2023-05-03T10:58:21.192+0000",
        //                     "identifier": "do_113788049229389824113",
        //                     "ownershipType": [
        //                         "createdBy"
        //                     ],
        //                     "compatibilityLevel": 1,
        //                     "audience": [
        //                         "Student"
        //                     ],
        //                     "trackable": {
        //                         "enabled": "Yes",
        //                         "autoBatch": "Yes"
        //                     },
        //                     "os": [
        //                         "All"
        //                     ],
        //                     "primaryCategory": "Course Unit",
        //                     "languageCode": [
        //                         "en"
        //                     ],
        //                     "downloadUrl": "https://sunbirddev.blob.core.windows.net/sunbird-content-dev/content/do_113788048780771328112/rajcourse001_1683111611570_do_113788048780771328112_1_SPINE.ecar",
        //                     "attributions": [],
        //                     "versionKey": "1683111478197",
        //                     "mimeType": "application/vnd.ekstep.content-collection",
        //                     "code": "da5ecc02-9c0d-4030-ab52-65cd3976839f",
        //                     "license": "CC BY 4.0",
        //                     "leafNodes": [
        //                         "do_113762457386450944167",
        //                         "do_113762457976889344169",
        //                         "do_113762457691021312168"
        //                     ],
        //                     "version": 2,
        //                     "contentType": "CourseUnit",
        //                     "language": [
        //                         "English"
        //                     ],
        //                     "lastPublishedOn": "2023-05-03T11:00:11.366+0000",
        //                     "objectType": "Content",
        //                     "status": "Live",
        //                     "dialcodeRequired": "No",
        //                     "userConsent": "Yes",
        //                     "idealScreenSize": "normal",
        //                     "contentEncoding": "gzip",
        //                     "leafNodesCount": 3,
        //                     "depth": 1,
        //                     "osId": "org.ekstep.launcher",
        //                     "contentDisposition": "inline",
        //                     "visibility": "Parent",
        //                     "credentials": {
        //                         "enabled": "Yes"
        //                     },
        //                     "variants": "{\"spine\":{\"ecarUrl\":\"https://sunbirddev.blob.core.windows.net/sunbird-content-dev/content/do_113788048780771328112/rajcourse001_1683111611570_do_113788048780771328112_1_SPINE.ecar\",\"size\":\"10458\"},\"online\":{\"ecarUrl\":\"https://sunbirddev.blob.core.windows.net/sunbird-content-dev/content/do_113788048780771328112/rajcourse001_1683111612008_do_113788048780771328112_1_ONLINE.ecar\",\"size\":\"5875\"}}",
        //                     "index": 1,
        //                     "pkgVersion": 1,
        //                     "idealScreenDensity": "hdpi"
        //                 }
        //             ],
        //             "primaryCategory": "Course",
        //             "contentEncoding": "gzip",
        //             "lockKey": "f4a04e84-4a4b-4b4b-9e47-159622eefc29",
        //             "generateDIALCodes": "No",
        //             "totalCompressedSize": 17571983,
        //             "mimeTypesCount": "{\"video/mp4\":3,\"application/vnd.ekstep.content-collection\":1}",
        //             "sYS_INTERNAL_LAST_UPDATED_ON": "2023-05-03T11:00:11.569+0000",
        //             "contentType": "Course",
        //             "livestockmanagement": [
        //                 "feedingandnutrition"
        //             ],
        //             "trackable": {
        //                 "enabled": "Yes",
        //                 "autoBatch": "Yes"
        //             },
        //             "identifier": "do_113788048780771328112",
        //             "audience": [
        //                 "Student"
        //             ],
        //             "foodcrops": [
        //                 "horticulture"
        //             ],
        //             "toc_url": "https://sunbirddev.blob.core.windows.net/sunbird-content-dev/content/do_113788048780771328112/artifact/do_113788048780771328112_toc.json",
        //             "visibility": "Default",
        //             "contentTypesCount": "{\"Resource\":3,\"CourseUnit\":1}",
        //             "author": "contentCreator Creator",
        //             "consumerId": "bfe5883f-ac66-4744-a064-3ed88d986eba",
        //             "childNodes": [
        //                 "do_113762457976889344169",
        //                 "do_113788049229389824113",
        //                 "do_113762457386450944167",
        //                 "do_113762457691021312168"
        //             ],
        //             "discussionForum": {
        //                 "enabled": "No"
        //             },
        //             "mediaType": "content",
        //             "osId": "org.ekstep.quiz.app",
        //             "lastPublishedBy": "469dc732-04f3-42d9-9a85-30957a797acc",
        //             "version": 2,
        //             "livestockspecies": [
        //                 "bees"
        //             ],
        //             "license": "CC BY 4.0",
        //             "size": 10458,
        //             "lastPublishedOn": "2023-05-03T11:00:11.366+0000",
        //             "name": "RajCourse001",
        //             "attributions": [],
        //             "targetBoardIds": [
        //                 "ncf_board_apboard"
        //             ],
        //             "status": "Live",
        //             "code": "org.sunbird.EghlUV",
        //             "publishError": null,
        //             "credentials": {
        //                 "enabled": "Yes"
        //             },
        //             "description": "Enter description for Course",
        //             "idealScreenSize": "normal",
        //             "createdOn": "2023-05-03T10:57:03.440+0000",
        //             "batches": [
        //                 {
        //                     "createdFor": [
        //                         "0137541424673095687"
        //                     ],
        //                     "endDate": null,
        //                     "name": "Test",
        //                     "batchId": "01379356137943040032",
        //                     "enrollmentType": "open",
        //                     "enrollmentEndDate": null,
        //                     "startDate": "2023-05-11",
        //                     "status": 1
        //                 }
        //             ],
        //             "foodcropss": [
        //                 "horticulture"
        //             ],
        //             "commercialcropss": [
        //                 "crops"
        //             ],
        //             "livestockmanagements": [
        //                 "geneticsandselection"
        //             ],
        //             "copyrightYear": 2023,
        //             "contentDisposition": "inline",
        //             "lastUpdatedOn": "2023-05-03T10:58:21.192+0000",
        //             "dialcodeRequired": "No",
        //             "lastStatusChangedOn": "2023-05-03T10:57:03.440+0000",
        //             "createdFor": [
        //                 "0137541424673095687"
        //             ],
        //             "creator": "contentCreator Creator",
        //             "os": [
        //                 "All"
        //             ],
        //             "flagReasons": null,
        //             "livestockmanagementss": [
        //                 "geneticsandselection"
        //             ],
        //             "se_FWIds": [
        //                 "framework1",
        //                 "NCF"
        //             ],
        //             "targetFWIds": [
        //                 "NCF"
        //             ],
        //             "pkgVersion": 1,
        //             "versionKey": "1683111501192",
        //             "idealScreenDensity": "hdpi",
        //             "framework": "framework1",
        //             "dialcodes": null,
        //             "depth": 0,
        //             "s3Key": "content/do_113788048780771328112/artifact/do_113788048780771328112_toc.json",
        //             "lastSubmittedOn": "2023-05-03T10:58:21.180+0000",
        //             "createdBy": "155ce3c5-713e-4749-bc1c-95d09c640914",
        //             "compatibilityLevel": 4,
        //             "leafNodesCount": 3,
        //             "userConsent": "Yes",
        //             "resourceType": "Course",
        //             "orgDetails": {
        //                 "email": null,
        //                 "orgName": "Sunbird Org"
        //             },
        //             "licenseDetails": {
        //                 "name": "CC BY 4.0",
        //                 "url": "https://creativecommons.org/licenses/by/4.0/legalcode",
        //                 "description": "This is the standard license of any content/youtube"
        //             }
        //         }
        //     }
        // }
          this.showLoader = false;
          if (response.result.content.status === 'Live' || response.result.content.status === 'Unlisted') {
            this.showPlayer = true;
            const contentDetails = {
              contentId: this.contentId,
              contentData: response.result.content
            };
            this.playerConfig = this.playerService.getConfig(contentDetails);
            this.contentData = response.result.content;
            this.setTelemetryData();
            this.windowScrollService.smoothScroll('content-player');
          } else {
            this.toasterService.warning(this.resourceService.messages.imsg.m0027);
          }
        },
        (err) => {
          this.showLoader = false;
          this.showError = true;
          this.errorMessage = this.resourceService.messages.stmsg.m0009;
        });
    } else {
      this.getPublicContent();
    }
  }

  getQuestionSetHierarchy() {
    const serveiceRef =  this.userService.loggedIn ? this.playerService : this.publicPlayerService;
    this.publicPlayerService.getQuestionSetHierarchy(this.contentId).pipe(
      takeUntil(this.unsubscribe$))
      .subscribe((response) => {
        this.showLoader = false;
        const contentDetails = {
          contentId: this.contentId,
          contentData: response.questionSet
        };
        this.playerConfig = serveiceRef.getConfig(contentDetails);
        this.playerConfig.context.objectRollup = this.objectRollup;
        this.contentData = response.questionSet;
        this.showPlayer = true;
      }, (err) => {
        this.showLoader = false;
        this.showError = true;
        this.errorMessage = this.resourceService.messages.stmsg.m0009;
      });
  }

  getPublicContent() {
    const options: any = { dialCode: this.dialCode };
    const params = { params: this.configService.appConfig.PublicPlayer.contentApiQueryParams };
    this.publicPlayerService.getContent(this.contentId, params).pipe(
      mergeMap((response) => {
        if (_.get(response, 'result.content.status') === 'Unlisted') {
          return throwError({
            code: 'UNLISTED_CONTENT'
          });
        }
        return of(response);
      }),
      takeUntil(this.unsubscribe$))
      .subscribe((response) => {
        this.showLoader = false;
        const contentDetails = {
          contentId: this.contentId,
          contentData: response.result.content
        };
        this.playerConfig = this.publicPlayerService.getConfig(contentDetails, options);
        this.playerConfig.context.objectRollup = this.objectRollup;
        this.contentData = response.result.content;
        this.showPlayer = true;
      }, (err) => {
        this.showLoader = false;
        this.showError = true;
        this.errorMessage = this.resourceService.messages.stmsg.m0009;
      });
  }

  copyContent(contentData: ContentData) {
    let successMsg = '';
    let errorMsg = '';
    this.isTypeCopyQuestionset = _.get(contentData, 'mimeType') === 'application/vnd.sunbird.questionset';
    this.isTypeCopyQuestionset ? (successMsg = this.resourceService.messages.smsg.m0067, errorMsg = this.resourceService.messages.emsg.m0067) : (successMsg = this.resourceService.messages.smsg.m0042, errorMsg = this.resourceService.messages.emsg.m0008);
    this.copyContentService.copyContent(contentData).subscribe(
      (response) => {
        this.toasterService.success(successMsg);
      },
      (err) => {
        this.toasterService.error(errorMsg);
      });
  }

  onShareLink() {
    this.shareLink = this.contentUtilsServiceService.getPublicShareUrl(this.contentId, this.contentData.mimeType);
    this.setTelemetryShareData(this.contentData);
  }

  ngAfterViewInit() {
    this.pageLoadDuration = this.navigationHelperService.getPageLoadTime();
  }

  setTelemetryShareData(param) {
    this.telemetryShareData = [{
      id: param.identifier,
      type: param.contentType,
      ver: param.pkgVersion ? param.pkgVersion.toString() : '1.0'
    }];
  }
  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
}
