// ==UserScript==
// @name		KLAS Helper custom
// @namespace	https://joyfui.wo.tc/
// @version		1.1
// @author		joyfuI
// @description	KLAS Helper에 개인적으로 덧붙인 유저 스크립트 (KLAS Helper 필요)
// @homepageURL	https://github.com/joyfuI/klas-helper
// @downloadURL	https://raw.githubusercontent.com/joyfuI/klas-helper/custom/klas-helper.user.js
// @include		https://klas.kw.ac.kr/*
// @run-at		document-end
// @grant		GM.xmlHttpRequest
// ==/UserScript==

(function () {
	"use strict";

	// window.onload 설정
	addEventListener('load', () => {
		// externalPathFunctions 함수 삽입
		for (let path in externalPathFunctions) {
			if (path === location.pathname) {
				document.head.appendChild(createElement('script', '(' + externalPathFunctions[path].toString() + ')();'));
			}
		}

		// internalPathFunctions 함수 실행
		for (let path in internalPathFunctions) {
			if (path === location.pathname) {
				internalPathFunctions[path]();
			}
		}

		// 로그인 세션 유지
		document.head.appendChild(createElement('script', 'setInterval(() => fetch("/"), 600000);'));
	});
})();

// 태그에 삽입되는 함수 목록
// 다른 확장 프로그램을 지원하기 위해 태그 삽입이 필요
const externalPathFunctions = {
	// 강의 계획서 조회 - 학부
	'/std/cps/atnlc/LectrePlanStdPage.do': () => {
		// 인증 코드 개선 및 메시지 제거
		appModule.getSearch = function () {
			this.selectYearHakgi = this.selectYear + ',' + this.selecthakgi;

			axios.post('LectrePlanStdList.do', this.$data).then(function (response) {
				this.list = response.data;
			}.bind(this));
		};
	},

	// 온라인 강의 컨텐츠 보기
	'/std/lis/evltn/OnlineCntntsStdPage.do': () => {
		// 온라인 강의 고유 번호 파싱
		appModule.$watch('list', function (watchValue) {
			const videoCodes = [];
			let videoCount = 0;

			for (let i = 0; i < watchValue.length; i++) {
				videoCount += watchValue[i].hasOwnProperty('starting');
			}

			for (let i = 0; i < watchValue.length; i++) {
				const videoInfo = watchValue[i];
				let	videoCode = '';

				if (!videoInfo.hasOwnProperty('starting')) {
					continue;
				}

				// 예외인 고유 번호는 직접 파싱해서 처리
				if (videoInfo.starting === null || videoInfo.starting === 'default.htm') {
					const postData = [];
					for (const key in videoInfo) postData.push(`${key}=${videoInfo[key]}`);

					axios.post('/spv/lis/lctre/viewer/LctreCntntsViewSpvPage.do', postData.join('&')).then(function (response) {
						if (response.data.indexOf('kwcommons.kw.ac.kr/em/') === -1) {
							videoCode = undefined;
						} else {
							videoCode = response.data.split('kwcommons.kw.ac.kr/em/')[1].split('"')[0];
						}
					});
				} else {
					videoCode = videoInfo.starting.split('/');
					videoCode = videoCode[videoCode.length - 1];
				}

				const syncTimer = setInterval(() => {
					if (videoCode === undefined) {
						videoCount--;
						clearInterval(syncTimer);
					} else if (videoCode !== '') {
						videoCodes.push({ index: i, videoCode });
						clearInterval(syncTimer);
					}
				}, 100);
			}

			// table 태그에 고유 번호 저장
			const syncTimer = setInterval(() => {
				if (videoCount === videoCodes.length) {
					document.querySelector('#prjctList').setAttribute('data-video-codes', JSON.stringify(videoCodes));
					clearInterval(syncTimer);
				}
			}, 100);
		});

		// 표 디자인 수정
		document.querySelector('#prjctList > colgroup > col:nth-of-type(6)').setAttribute('width', '5%');
		document.querySelector('#prjctList > colgroup > col:nth-of-type(7)').setAttribute('width', '15%');
	}
};

// 태그에 삽입되지 않는 함수 목록
// GM 기능을 사용하기 위해 유저 스크립트 내부의 함수가 필요
const internalPathFunctions = {
	// 온라인 강의 컨텐츠 보기
	'/std/lis/evltn/OnlineCntntsStdPage.do': () => {
		// MutationObserver 삽입
		const observer = new MutationObserver(function (mutationList, observer) {
			// table 태그에 저장한 고유 번호 파싱
			const videoCodes = JSON.parse(mutationList[0].target.dataset.videoCodes);

			// 이미 생성된 다운로드 버튼 제거
			document.querySelectorAll('.btn-download').forEach(function (item) {
				item.style.display = 'none';
			});

			// 동영상 XML 정보 획득
			for (const videoInfo of videoCodes) {
				GM.xmlHttpRequest({
					method: 'GET',
					url: 'https://kwcommons.kw.ac.kr/viewer/ssplayer/uniplayer_support/content.php?content_id=' + videoInfo.videoCode,
					onload: function (response) {
						const documentXML = response.responseXML;
						const videoURLs = [];

						// 분할된 동영상 등 다양한 상황 처리
						try {
							if (documentXML.getElementsByTagName('desktop').length > 0) {
								videoURLs.push(documentXML.getElementsByTagName('media_uri')[0].innerHTML);
							} else {
								const mediaURI = documentXML.getElementsByTagName('media_uri')[0].innerHTML;

								for (const videoName of documentXML.getElementsByTagName('main_media')) {
									videoURLs.push(mediaURI.replace('[MEDIA_FILE]', videoName.innerHTML));
								}
							}
						} catch (error) {
							console.error(videoInfo.videoCode + '\n' + error);
						}

						// 다운로드 버튼 렌더링
						videoURLs.forEach((videoURL, i) => {
							const tdList = document.getElementById('prjctList').querySelectorAll(`tbody > tr:nth-of-type(${videoInfo.index + 1}) > td`);
							let tdElement = tdList[tdList.length - 1];
							tdElement = tdElement.className === '' ? tdElement : tdList[tdList.length - 2];

							tdElement.appendChild(createElement('div', `
								<a href="${videoURL}" target="_blank" style="display: block; margin-top: 10px">
									<button type="button" class="btn2 btn-gray btn-download">동영상 받기 #${i + 1}</button>
								</a>
							`));
						});
					}
				});
			}
		});

		// MutationObserver 감지 시작
		observer.observe(document.querySelector('#prjctList'), { attributes: true });
	}
};

// Element 생성
function createElement(elementName, htmlCode) {
	const newElement = document.createElement(elementName);
	newElement.innerHTML = htmlCode;
	return newElement;
}
