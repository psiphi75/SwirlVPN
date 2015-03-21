/******************************************************************************
 *                                                                            *
 *    SwirlVPN is free software: you can redistribute it and/or modify        *
 *    it under the terms of the GNU General Public License as published by    *
 *    the Free Software Foundation, either version 3 of the License, or       *
 *    (at your option) any later version.                                     *
 *                                                                            *
 *    SwirlVPN is distributed in the hope that it will be useful,             *
 *    but WITHOUT ANY WARRANTY; without even the implied warranty of          *
 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the           *
 *    GNU General Public License for more details.                            *
 *                                                                            *
 *    You should have received a copy of the GNU General Public License       *
 *    along with SwirlVPN.  If not, see <http://www.gnu.org/licenses/>.       *
 *                                                                            *
 ******************************************************************************/

/**
 * emailLayout.js
 *
 * This module is a helper that contains functions to format the emails.  When
 * using this module you can create Text and HTML based email using the same
 * formatting.
 *
 */

/*jslint node:true*/
'use strict';


var EmailContent = function () {

    this.content = {
        text: '',
        html: htmlHeader
    };

    var EOL = '\n';

    /* The HTML we replace and the text that we replace it with */
    var replacementHTML = ['<b>','</b>','&nbsp;','<p>','</p>'];
    var replacementText = ['',   '',    ' ',     '\n', ''];

    this.addContentTitle = function (title) {
        this.content.text += title + EOL + EOL;
        this.content.html += '<h4 align="left" class="article-title">' + title + '</h4>';
    };

    this.addContentSubTitle = function (subTitle) {
        this.content.text += subTitle + EOL + EOL;
        this.content.html += '<h6 align="left" class="article-title">' + subTitle + '</h6>';
    };

    this.addContentBlurb = function (blurb) {
        this.content.text += blurb + EOL + EOL;
        this.content.html += '<div align="left" class="article-content"><p>' + blurb + '</p></div>';
    };


    this.addContentLinkWithPreText = function (text, link) {
        this.content.text += text + ' ' + link + EOL + EOL;
        this.content.html += '<div align="left" class="article-content"><p>' + text +
                        '  <a href="' + link + '">' + link + '</a></p></div>';
    };

    this.addContentLink = function (link, linkText) {
        if (!linkText) {
            linkText = link;
            this.content.text += link + EOL + EOL;
        } else {
            this.content.text += linkText + link + EOL + EOL;
        }
        this.content.html += '<div align="left" class="article-content"><p>' +
                        '  <a href="' + link + '">' + linkText +'</a>' +
                        '</p></div>';
    };

    this.addInlineLink = function (link, linkText) {
        if (!linkText) {
            linkText = link;
            this.content.text += link;
        } else {
            this.content.text += linkText + ' (' + link + ')';
        }
        this.content.html += '<a href="' + link + '">' + linkText +'</a>';
    };

    this.addText = function (text) {
        this.content.text += text;
    };

    this.addHTML = function (html) {
        this.content.html += html;
    };

    /* Removes the HTML tags and replaces them with the equivalent text */
    this.cleanupText = function () {
        for (var i=0; i<replacementHTML.length; i++) {
            var htmlTag = replacementHTML[i];
            var textEquiv = replacementText[i];

            // var find = 'abc';
			var re = new RegExp(htmlTag, 'g');

			this.content.text = this.content.text.replace(re, textEquiv);
            // this.content.text.replace(htmlTag, textEquiv);
        }
    };

    this.done = function () {
        this.content.text += EOL;
        this.cleanupText();

        this.content.html += htmlFooter;

        return this.content;
    };

};

exports.EmailContent = EmailContent;


var htmlHeader = '<!DOCTYPE html>';
htmlHeader += '<html xmlns="http://www.w3.org/1999/xhtml"><head>';
htmlHeader += '  <title>Swirl VPN</title>';
htmlHeader += '  <meta http-equiv="Content-Type" content="text/html; charset=us-ascii"/>';
htmlHeader += '  <style type="text/css">';
htmlHeader += '/*<![CDATA[*/';
htmlHeader += '  /* Mobile-specific Styles */';
htmlHeader += '  @media only screen and (max-width: 660px) {';
htmlHeader += '  table[class=w30], td[class=w30], img[class=w30] { width:10px !important; }';
htmlHeader += '  table[class=w580], td[class=w580], img[class=w580] { width:280px !important; }';
htmlHeader += '  table[class=w640], td[class=w640], img[class=w640] { width:300px !important; }';
htmlHeader += '  #headline p { font-size: 30px !important; }';
htmlHeader += '  .article-content, #left-sidebar{ -webkit-text-size-adjust: 90% !important; -ms-text-size-adjust: 90% !important; }';
htmlHeader += '  } ';
htmlHeader += '  /* Client-specific Styles */';
htmlHeader += '  #outlook a { padding: 0; }  /* Force Outlook to provide a "view in browser" button. */';
htmlHeader += '  body { width: 100% !important; }';
htmlHeader += '  .ReadMsgBody { width: 100%; }';
htmlHeader += '  .ExternalClass { width: 100%; display:block !important; } /* Force Hotmail to display emails at full width */';
htmlHeader += '  /* Reset Styles */';
htmlHeader += '  /* Add 100px so mobile switch bar does not cover street address. */';
htmlHeader += '  body { background-color: #fff; margin: 0; padding: 0; }';
htmlHeader += '  h1 { color: #eee; }';
htmlHeader += '  img { outline: none; text-decoration: none; display: block;}';
htmlHeader += '  h1 a:active, h2 a:active,  h3 a:active, h4 a:active, h5 a:active, h6 a:active { color: red !important; }';
htmlHeader += '  /* Preferably not the same color as the normal header link color.  There is limited support for psuedo classes in email clients, this was added just for good measure. */';
htmlHeader += '  h1 a:visited, h2 a:visited,  h3 a:visited, h4 a:visited, h5 a:visited, h6 a:visited { color: purple !important; }';
htmlHeader += '  /* Preferably not the same color as the normal header link color. There is limited support for psuedo classes in email clients, this was added just for good measure. */  ';
htmlHeader += '  table td, table tr { border-collapse: collapse; }';
htmlHeader += '  .yshortcuts, .yshortcuts a, .yshortcuts a:link,.yshortcuts a:visited, .yshortcuts a:hover, .yshortcuts a span {';
htmlHeader += '  color: black; text-decoration: none !important; border-bottom: none !important; background: none !important;';
htmlHeader += '  }   /* Body text color for the New Yahoo.  This example sets the font of Yahoo´s Shortcuts to black. */';
htmlHeader += '  /* This most probably won´t work in all email clients. Don´t include code blocks in email. */';
htmlHeader += '  #background-table { background-color: #fff; }';
htmlHeader += '  /* Fonts and Content */';
htmlHeader += '  body, td { font-family: Arial, Helvetica, Geneva, sans-serif;     ';
htmlHeader += '    border-radius: 4px;';
htmlHeader += '    -moz-border-radius: 4px;';
htmlHeader += '    }';
htmlHeader += '  #headline p { color: #eee; font-family: Arial, Helvetica, Geneva, sans-serif; font-size: 36px; text-align: center; margin-top:15px; margin-bottom:15px; }';
htmlHeader += '  .article-title, h4 { font-size: 18px; line-height:24px; color: #337; font-weight:bold; margin-top:10px; margin-bottom:10px; font-family: Arial, Helvetica, Geneva, sans-serif; }';
htmlHeader += '  .article-title, h6 { font-size: 14px; line-height:24px; color: #337; font-weight:bold; margin-top:10px; margin-bottom:10px; font-family: Arial, Helvetica, Geneva, sans-serif; }';
htmlHeader += '  .article-content { font-size: 13px; line-height: 18px; color: #444444; margin-top: 0px; margin-bottom: 18px; font-family: Arial, Helvetica, Geneva, sans-serif; }';
htmlHeader += '  .article-content a { color: #00707b; font-weight:bold; text-decoration:none; }';
htmlHeader += '  .article-content img { max-width: 100% }';
htmlHeader += '  .article-content ol, .article-content ul { margin-top:0px; margin-bottom:18px; margin-left:19px; padding:0; }';
htmlHeader += '  .article-content li { font-size: 13px; line-height: 18px; color: #444444; }';
htmlHeader += '  .article-content li a { color: #00707b; text-decoration:underline; }';
htmlHeader += '  .article-content p {margin-bottom: 15px;}';
htmlHeader += '  /*]]>*/';
htmlHeader += '  </style>';
htmlHeader += '</head>';
htmlHeader += '<body>';
htmlHeader += '  <table width="100%" cellpadding="0" cellspacing="0" border="0" id="background-table">';
htmlHeader += '    <tbody>';
htmlHeader += '      <tr>';
htmlHeader += '        <td align="center" bgcolor="#fff">';
htmlHeader += '          <table class="w640" style="margin:0 10px;" width="640" cellpadding="0" cellspacing="0" border="0">';
htmlHeader += '            <tbody>';
htmlHeader += '              <tr>';
htmlHeader += '                <td class="w640" width="640" height="20"></td>';
htmlHeader += '              </tr>';
htmlHeader += '              <tr>';
htmlHeader += '                <td id="header" class="w640" width="640" align="center" bgcolor="#00002c">';
htmlHeader += '                  <table class="w640" width="640" cellpadding="0" cellspacing="0" border="0">';
htmlHeader += '                    <tbody>';
htmlHeader += '                      <tr>';
htmlHeader += '                        <td class="w580" width="580">';
htmlHeader += '                          <div align="center" id="headline">';
htmlHeader += '                            <h1><strong><em><span class="cm-singleline" style="color:#eee">Swirl VPN</span></em></strong></h1>';
htmlHeader += '                          </div>';
htmlHeader += '                        </td>';
htmlHeader += '                      </tr>';
htmlHeader += '                    </tbody>';
htmlHeader += '                  </table>';
htmlHeader += '                </td>';
htmlHeader += '              </tr>';
htmlHeader += '              <tr>';
htmlHeader += '                <td class="w640" width="640" height="10" bgcolor="#fff"></td>';
htmlHeader += '              </tr>';
htmlHeader += '              <tr id="simple-content-row">';
htmlHeader += '                <td class="w640" width="640" bgcolor="#eee">';
htmlHeader += '                  <table class="w640" width="640" cellpadding="0" cellspacing="0" border="0">';
htmlHeader += '                    <tbody>';
htmlHeader += '                      <tr>';
htmlHeader += '                        <td class="w30" width="30"></td>';
htmlHeader += '                        <td class="w580" width="580" id="content-column">';
htmlHeader += '                          <table class="w580" width="580" cellpadding="0" cellspacing="0" border="0">';
htmlHeader += '                            <tbody>';
htmlHeader += '                              <tr>';
htmlHeader += '                                <td class="w580" width="580">';

var htmlFooter = '';
htmlFooter += '                                </td>';
htmlFooter += '                              </tr>';
htmlFooter += '                              <tr>';
htmlFooter += '                                <td class="w580" width="580" height="10"></td>';
htmlFooter += '                              </tr>';
htmlFooter += '                            </tbody>';
htmlFooter += '                          </table>';
htmlFooter += '                        </td>';
htmlFooter += '                        <td class="w30" width="30"></td>';
htmlFooter += '                      </tr>';
htmlFooter += '                    </tbody>';
htmlFooter += '                  </table>';
htmlFooter += '                </td>';
htmlFooter += '              </tr>';
htmlFooter += '              <tr>';
htmlFooter += '                <td class="w640" width="640" height="10" bgcolor="#fff"></td>';
htmlFooter += '              </tr>';
htmlFooter += '             <tr>';
htmlFooter += '                <td id="footer" class="w640" width="640" align="center" bgcolor="#00002c">';
htmlFooter += '                  <table class="w640" width="640" cellpadding="0" cellspacing="0" border="0">';
htmlFooter += '                    <tbody>';
htmlFooter += '                      <tr>';
htmlFooter += '                        <td class="w580" width="580" height="25px">';
htmlFooter += '                          <div align="center" >';
htmlFooter += '                            <p></p>';
htmlFooter += '                          </div>';
htmlFooter += '                        </td>';
htmlFooter += '                      </tr>';
htmlFooter += '                    </tbody>';
htmlFooter += '                  </table>';
htmlFooter += '                </td>';
htmlFooter += '              </tr>';
htmlFooter += '            </tbody>';
htmlFooter += '          </table>';
htmlFooter += '        </td>';
htmlFooter += '      </tr>';
htmlFooter += '    </tbody>';
htmlFooter += '  </table>';
htmlFooter += '</body></html>';

