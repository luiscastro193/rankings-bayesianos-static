"use strict";
if (location.protocol == 'http:' && location.hostname != 'localhost') location.protocol = 'https:';
const posColor = {r: 45, g: 156, b: 149};
const negColor = {r: 195, g: 69, b: 104};
const transparency = 0.15;
const postLimit = 10;

function loadUser() {
	document.getElementById('welcomeMsg').innerHTML = '';
	document.getElementById('signOut').innerHTML = '';
	
	get("/username", true).then(username => {
		document.getElementById('welcomeMsg').textContent = `Bienvenido, ${username}.`;
		document.getElementById('signOut').textContent = "Log out";
	}).catch(() => {});
	
	localStorage.cookie = 'true';
}

function clearUser() {
	gapi.auth2.getAuthInstance().signOut();
	localStorage.removeItem('cookie');
	location.reload();
}

function goTo(uri, event) {
	if (event && (event.ctrlKey || event.metaKey || event.shiftKey || event.which > 1))
		return true;
	
	uri = uri.substr(uri.lastIndexOf('#') + 1);
	if (location.hash.substr(1) == uri) loadURI();
	else location.hash = uri;
		
	event && event.preventDefault();
}

document.addEventListener('click', function(event) {
	if (event.target.nodeName.toLowerCase() == 'a' && event.target.href.startsWith(location.origin))
		goTo(event.target.href, event);
});

function postIssue(form) {
	let button = form.querySelector(".propose-button");
	button.disabled = true;
	button.value = "Proponiendo...";
	
	post('/issue', {content: form.elements.issueText.value}, true).then(() => {
		goTo("#/new");
	}).catch(error => {
		errorHandler(error);
		button.value = "Proponer";
		button.disabled = false;
	});
}

function postAnswer(form, issueid) {
	let button = form.querySelector(".propose-button");
	button.disabled = true;
	button.value = "Proponiendo...";
	
	post('/answer', {issueid, content: form.elements.answerText.value}, true).then(() => {
		goTo(`#/issue/${issueid}/new`);
	}).catch(error => {
		errorHandler(error);
		button.value = "Proponer";
		button.disabled = false;
	});
}

function setColors(postNode, score) {
	let posMultiplier = Math.max(0, Math.min(score, 100)) / 100;
	let negMultiplier = 1 - posMultiplier;
	let rgb = `${(posColor.r * posMultiplier + negColor.r * negMultiplier).toFixed()}, ${(posColor.g * posMultiplier + negColor.g * negMultiplier).toFixed()}, ${(posColor.b * posMultiplier + negColor.b * negMultiplier).toFixed()}`;
	postNode.querySelector("[name=score]").style.color = `rgb(${rgb})`;
	postNode.style.borderColor = `rgb(${rgb})`;
	postNode.style.backgroundColor = `rgba(${rgb}, ${transparency})`;
}

function setLinks(postNode, vote, order, funct = rateIssue) {
	let positive = postNode.querySelector(".positive");
	let negative = postNode.querySelector(".negative");
	
	if (vote === true) {
		positive.style.fontWeight = 'bold';
		negative.style.fontWeight = 'normal';
		positive.querySelector('a').onclick = function() { funct(postNode, null, order) };
		negative.querySelector('a').onclick = function() { funct(postNode, false, order) };
	}
	else if (vote === false) {
		positive.style.fontWeight = 'normal';
		negative.style.fontWeight = 'bold';
		positive.querySelector('a').onclick = function() { funct(postNode, true, order) };
		negative.querySelector('a').onclick = function() { funct(postNode, null, order) };
	}
	else {
		positive.style.fontWeight = 'normal';
		negative.style.fontWeight = 'normal';
		positive.querySelector('a').onclick = function() { funct(postNode, true, order) };
		negative.querySelector('a').onclick = function() { funct(postNode, false, order) };
	}
}

function rateIssue(issue, vote, order) {
	let chosenScore;
	
	switch (order) {
		case 'promising':
			chosenScore = 'promisingScore';
			break;
		case 'consolidated':
			chosenScore = 'consolidatedScore';
			break;
		default:
			chosenScore = 'score';
	}
	
	post('/issue-vote', {issueid: issue.issueid, vote}, true).then(scores => {
		let newScore = scores[chosenScore];
		issue.querySelector("[name=score]").textContent = newScore.toFixed();
		setColors(issue, newScore);
		setLinks(issue, vote, order);
		issue.querySelector("[name=trues]").textContent = scores.trues;
		issue.querySelector("[name=falses]").textContent = scores.falses;
	}).catch(errorHandler);
}

function rateAnswer(answer, vote, order) {
	let chosenScore;
	
	switch (order) {
		case 'promising':
			chosenScore = 'promisingScore';
			break;
		case 'consolidated':
			chosenScore = 'consolidatedScore';
			break;
		default:
			chosenScore = 'score';
	}
	
	post('/answer-vote', {answerid: answer.answerid, vote}, true).then(scores => {
		let newScore = scores[chosenScore];
		answer.querySelector("[name=score]").textContent = newScore.toFixed();
		setColors(answer, newScore);
		setLinks(answer, vote, order, rateAnswer);
		answer.querySelector("[name=trues]").textContent = scores.trues;
		answer.querySelector("[name=falses]").textContent = scores.falses;
	}).catch(errorHandler);	
}

function seeMore(element) {
	let p = element.previousSibling;
	
	if (p.style.maxHeight)
		p.style.maxHeight = parseInt(p.style.maxHeight) + 30 + 'em';
	else
		p.style.maxHeight = '30em';
	
	if (p.offsetHeight >= p.scrollHeight)
		element.parentNode.removeChild(element);
}

function loadIssues(order = 'promising', offset = 0) {
	document.title = "Rankings bayesianos";
	
	document.querySelector('main').innerHTML = `<section class='order-bar'>
		<a id="newLink" href="#/new">Nuevas</a>
		<a id="promisingLink" href="#/promising">Prometedoras</a>
		<a id="bestLink" href="#/best">Mejores</a>
		<a id="consolidatedLink" href="#/consolidated">Consolidadas</a>
	</section>
	<section class='posts-box'>
		<form class='post-form' onsubmit="postIssue(this); return false">
			<textarea class='post-input' name="issueText" rows=4 oninput="while (this.offsetHeight <= this.scrollHeight) this.rows += 4"
				placeholder="Propón una nueva cuestión..." required></textarea>
			<input class="propose-button" type="submit" value="Proponer">
		</form>
	</section>`;
	
	document.getElementById(order + 'Link').style.fontWeight = 'bold';
	let form = document.querySelector('form');
	
	get('/issues/' + order + '?offset=' + offset, isSignedIn()).then(issues => {
		for (let issue of issues.issues) {
			form.insertAdjacentHTML('beforebegin', `<article>
				<p class='post-content'><a href="#/issue/${issue.issueid}"></a></p>
				<p class='post-info'></p>
				<section class='voting-box'>
					<p class='positive'><a class='positive' href="javascript:void(0)">A favor</a> (<span name='trues'>${issue.trues}</span>)</p>
					<p class='negative'><a class='negative' href="javascript:void(0)">En contra</a> (<span name='falses'>${issue.falses}</span>)</p>
					<p>Puntuación: <span name='score'>${issue.chosen_score.toFixed()}</span></p>
				</section>
			</article>`);
			
			let issueNode = form.previousSibling;
			issueNode.issueid = issue.issueid;
			
			let content = issueNode.querySelector(".post-content");
			let info = issueNode.querySelector(".post-info");
			content.querySelector('a').textContent = issue.content;
			info.textContent = `${moment(issue.created_at).fromNow()} por ${issue.username}`;
			
			if (content.offsetHeight < content.scrollHeight) {
				content.insertAdjacentHTML('afterend', `<p><a href="javascript:void(0)" onclick="seeMore(this.parentNode)">Ver más</a><p>`);
				if (content.scrollHeight <= content.offsetHeight + content.nextSibling.scrollHeight) content.nextSibling.firstChild.click();
			}
			if (info.offsetHeight < info.scrollHeight) {
				info.insertAdjacentHTML('afterend', `<p><a href="javascript:void(0)" onclick="seeMore(this.parentNode)">Ver más</a><p>`);
				if (info.scrollHeight <= info.offsetHeight + info.nextSibling.scrollHeight) info.nextSibling.firstChild.click();
			}
			
			setLinks(issueNode, issue.vote, order);
			setColors(issueNode, issue.chosen_score);
		}
		
		if (issues.more)
			form.insertAdjacentHTML('afterend',
				`<button class='load-more' onclick="loadIssues('${order}', ${offset + postLimit}); history.pushState({offset: ${offset + postLimit}}, '')">Cargar siguientes</button>`);
	}).catch(errorHandler);
}

function loadAnswers(issueid, order, offset = 0) {
	let form = document.querySelector('form');
	
	form.parentNode.removeChild(form.nextSibling);
	while (form.previousSibling) form.parentNode.removeChild(form.previousSibling);
	
	get('/issue/' + issueid + '/answers/' + order + '?offset=' + offset, isSignedIn()).then(answers => {
		for (let answer of answers.answers) {
			form.insertAdjacentHTML('beforebegin', `<article>
				<p class='post-content'></p>
				<p class='post-info'></p>
				<section class='voting-box'>
					<p class='positive'><a class='positive' href="javascript:void(0)">A favor</a> (<span name='trues'>${answer.trues}</span>)</p>
					<p class='negative'><a class='negative' href="javascript:void(0)">En contra</a> (<span name='falses'>${answer.falses}</span>)</p>
					<p>Puntuación: <span name='score'>${answer.chosen_score.toFixed()}</span></p>
				</section>
			</article>`);
			
			let answerNode = form.previousSibling;
			answerNode.answerid = answer.answerid;
			
			let content = answerNode.querySelector(".post-content");
			let info = answerNode.querySelector(".post-info");
			content.textContent = answer.content;
			info.textContent = `${moment(answer.created_at).fromNow()} por ${answer.username}`;
			
			if (content.offsetHeight < content.scrollHeight) {
				content.insertAdjacentHTML('afterend', `<p><a href="javascript:void(0)" onclick="seeMore(this.parentNode)">Ver más</a><p>`);
				if (content.scrollHeight <= content.offsetHeight + content.nextSibling.scrollHeight) content.nextSibling.firstChild.click();
			}
			if (info.offsetHeight < info.scrollHeight) {
				info.insertAdjacentHTML('afterend', `<p><a href="javascript:void(0)" onclick="seeMore(this.parentNode)">Ver más</a><p>`);
				if (info.scrollHeight <= info.offsetHeight + info.nextSibling.scrollHeight) info.nextSibling.firstChild.click();
			}

			setLinks(answerNode, answer.vote, order, rateAnswer);
			setColors(answerNode, answer.chosen_score);
		}
		
		if (answers.more)
			form.insertAdjacentHTML('afterend',
				`<button class='load-more' onclick="loadAnswers('${issueid}', '${order}', ${offset + postLimit}); history.pushState({offset: ${offset + postLimit}}, '')">Cargar siguientes</button>`);
	}).catch(errorHandler);
}

function loadIssue(issueid, order = 'promising', offset = 0) {
	document.querySelector('main').innerHTML = `<section class='order-bar'>
		<a id="newLink" href="#/issue/${issueid}/new">Nuevas</a>
		<a id="promisingLink" href="#/issue/${issueid}/promising">Prometedoras</a>
		<a id="bestLink" href="#/issue/${issueid}/best">Mejores</a>
		<a id="consolidatedLink" href="#/issue/${issueid}/consolidated">Consolidadas</a>
	</section>
	<section class='posts-box'>
		<form class='post-form' onsubmit="postAnswer(this, '${issueid}'); return false">
			<textarea class='post-input' name="answerText" rows=4 oninput="while (this.offsetHeight <= this.scrollHeight) this.rows += 4"
				placeholder="Propón una nueva respuesta..." required></textarea>
			<input class="propose-button" type="submit" value="Proponer">
		</form>
	</section>`;
	
	document.getElementById(order + 'Link').style.fontWeight = 'bold';
	let orderBar = document.querySelector('.order-bar');

	get('/issue/' + issueid, isSignedIn()).then(issue => {
		document.title = `${issue.content} - Ranking bayesianos`;
		
		orderBar.insertAdjacentHTML('beforebegin', `<section class='posts-box'>
			<article>
				<p class='post-content'></p>
				<p class='post-info'></p>
				<section class='voting-box'>
					<p class='positive'><a class='positive' href="javascript:void(0)">A favor</a> (<span name='trues'>${issue.trues}</span>)</p>
					<p class='negative'><a class='negative' href="javascript:void(0)">En contra</a> (<span name='falses'>${issue.falses}</span>)</p>
					<p>Puntuación: <span name='score'>${issue.score.toFixed()}</span></p>
				</section>
			</article>
		</section>`);
		
		let issueNode = orderBar.previousSibling.querySelector('article');
		issueNode.issueid = issueid;
		
		let content = issueNode.querySelector(".post-content");
		let info = issueNode.querySelector(".post-info");
		content.textContent = issue.content;
		info.textContent = `${moment(issue.created_at).fromNow()} por ${issue.username}`;
		
		if (content.offsetHeight < content.scrollHeight)
			content.insertAdjacentHTML('afterend', `<p><a href="javascript:void(0)" onclick="seeMore(this.parentNode)">Ver más</a><p>`);
		if (info.offsetHeight < info.scrollHeight)
			info.insertAdjacentHTML('afterend', `<p><a href="javascript:void(0)" onclick="seeMore(this.parentNode)">Ver más</a><p>`);

		setLinks(issueNode, issue.vote);
		setColors(issueNode, issue.score);
	}).catch(errorHandler);
	
	loadAnswers(issueid, order, offset);
}

function loadURI(event) {
	let uri = location.hash.split('/');
	let offset = event && event.state && event.state.offset || 0;
	
	if (uri.length > 2) {
		if (uri[3] == 'new' || uri[3] == 'promising' || uri[3] == 'best' || uri[3] == 'consolidated')
			loadIssue(uri[2], uri[3], offset);
		else
			loadIssue(uri[2], undefined, offset);
	}
	else if (uri[1] == 'new' || uri[1] == 'promising' || uri[1] == 'best' || uri[1] == 'consolidated')
		loadIssues(uri[1], offset);
	else
		loadIssues(undefined, offset);
}

window.onpopstate = loadURI;

function onLogin() {
	loadUser();
	loadURI();
}

document.addEventListener("DOMContentLoaded", function(event) {
	if (localStorage.cookie) {
		signIn().then(() => {
			if (document.querySelector('.default-msg')) loadURI();
		}).catch(() => {
			localStorage.removeItem('cookie');
			loadURI();
		});
	}
	else
		loadURI();
});
