import charWidth from 'char-width';
import type {
	NapCatPluginContext,
} from 'napcat-types/napcat-onebot/network/plugin/types';

/**
 * 提供字符计算服务
 */
export class CharService {
	private ctx: NapCatPluginContext;
	
	constructor( ctx: NapCatPluginContext ) {
		this.ctx = ctx;
	}
	
	/**
	 * 判断输入的字符是否为全角字符
	 */
	private isFullWidthChar( char: string ) {
		return charWidth( char ) === 2;
	}
	
	/**
	 * 基于 微软雅黑字体 的半角字符宽度映射表
	 */
	private halfWidthCharWidthFactorMapper: Record<string, number> = {
		'0': 0.5625,
		'1': 0.5,
		'2': 0.5625,
		'3': 0.5625,
		'4': 0.6875,
		'5': 0.625,
		'6': 0.625,
		'7': 0.5625,
		'8': 0.5625,
		'9': 0.5625,
		'!': 0.3125,
		'"': 0.4375,
		'#': 0.6875,
		'$': 0.625,
		'%': 0.875,
		'&': 0.9375,
		'\'': 0.3125,
		'(': 0.375,
		')': 0.375,
		'*': 0.4375,
		'+': 0.75,
		',': 0.25,
		'-': 0.4375,
		'.': 0.25,
		'/': 0.5625,
		':': 0.25,
		';': 0.25,
		'<': 0.75,
		'=': 0.75,
		'>': 0.75,
		'?': 0.5,
		'@': 1.0625,
		'A': 0.8125,
		'B': 0.6875,
		'C': 0.6875,
		'D': 0.8125,
		'E': 0.625,
		'F': 0.625,
		'G': 0.75,
		'H': 0.8125,
		'I': 0.3125,
		'J': 0.4375,
		'K': 0.75,
		'L': 0.625,
		'M': 1,
		'N': 0.8125,
		'O': 0.8125,
		'P': 0.6875,
		'Q': 0.875,
		'R': 0.75,
		'S': 0.5625,
		'T': 0.625,
		'U': 0.75,
		'V': 0.75,
		'W': 1.125,
		'X': 0.75,
		'Y': 0.6875,
		'Z': 0.625,
		'[': 0.4375,
		'\\': 0.5625,
		']': 0.25,
		'^': 0.75,
		'_': 0.5625,
		'`': 0.3125,
		'a': 0.5625,
		'b': 0.6875,
		'c': 0.5,
		'd': 0.625,
		'e': 0.5625,
		'f': 0.4375,
		'g': 0.625,
		'h': 0.6875,
		'i': 0.25,
		'j': 0.375,
		'k': 0.6875,
		'l': 0.3125,
		'm': 1,
		'n': 0.6875,
		'o': 0.625,
		'p': 0.6875,
		'q': 0.625,
		'r': 0.5,
		's': 0.5,
		't': 0.375,
		'u': 0.5625,
		'v': 0.625,
		'w': 0.875,
		'x': 0.625,
		'y': 0.625,
		'z': 0.5,
		'{': 0.375,
		'|': 0.3125,
		'}': 0.3125,
		'~': 0.75,
		' ': 0.295,
	};
	
	/**
	 * 预估输入的字符宽度 (单行计算)
	 */
	calculateTextWidth( text: string, fontSize: number = 16 ) {
		if ( !text || fontSize <= 0 ) {
			return { totalWidth: 0 };
		}
		
		const charWidthList: [ string, number ][] = [];
		for ( const char of text ) {
			let widthFactor = 1;
			if ( !this.isFullWidthChar( char ) ) {
				const halfWidthCharWidthFactor = this.halfWidthCharWidthFactorMapper[ char ];
				widthFactor = halfWidthCharWidthFactor
					? halfWidthCharWidthFactor
					: 0.6;
			}
			charWidthList.push( [ char, widthFactor ] );
		}
		
		const totalWidth = charWidthList.reduce( ( totalWidth, [ _, width ] ) => totalWidth + fontSize * width, 0 );
		this.ctx.logger.debug( `计算文本 ${ text } 的宽度完成: ${ totalWidth }px` );
		
		return {
			totalWidth,
		};
	}
	
}
